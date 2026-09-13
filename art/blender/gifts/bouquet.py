"""花束 — nine red roses in dark plum paper with a gold tie. `closed` = tight buds, `open` = bloom."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from common import (  # noqa: E402
    assign,
    bevel,
    camera,
    emissive,
    gold,
    group,
    hide_unless,
    principled,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    velvet,
)

sc = reset_scene()


def sheen(mat, weight, roughness=0.4):
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = weight
    b.inputs["Sheen Roughness"].default_value = roughness
    return mat


rose_mat = sheen(
    principled("RosePetal", **{"Base Color": (0.19, 0.009, 0.028, 1), "Roughness": 0.62}), 0.3, 0.3
)
leaf_mat = principled("Leaf", **{"Base Color": (0.035, 0.11, 0.05, 1), "Roughness": 0.5})
stem_mat = principled("Stem", **{"Base Color": (0.05, 0.10, 0.05, 1), "Roughness": 0.7})
paper_mat = sheen(velvet("Paper", (0.055, 0.022, 0.065, 1)), 0.3, 0.5)
ribbon_mat = gold("Ribbon", roughness=0.22)

# heads sit on a dome facing the camera (camera looks along +Y)
FACE = Vector((0, -0.38, 0.92)).normalized()
RIGHT = Vector((1, 0, 0))
UP = FACE.cross(RIGHT).normalized()
CENTER = Vector((0, 0.12, 0.46))

HEAD_SPREAD = [(0.0, 0.0)]
for i in range(5):
    HEAD_SPREAD.append((0.66, 2 * math.pi * i / 5 + math.radians(18)))
for i in range(3):
    HEAD_SPREAD.append((1.3, 2 * math.pi * i / 3 + math.radians(90)))


def head_dir(spread, angle, gather):
    s = spread * gather
    return (FACE + s * (math.cos(angle) * RIGHT + math.sin(angle) * UP)).normalized()


def rose_head(idx, direction, dome, openness):
    """A rose as nested open cups (the spiral) plus a ring of outer petals."""
    radius = 0.34 + 0.11 * openness
    parts = []

    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 0.2, segments=20, ring_count=12)
    bud = bpy.context.object
    bud.name = f"Bud{idx}"
    bud.scale = (1.0, 1.0, 1.35)
    bud.location = (0, 0, radius * 0.26)
    assign(shade_smooth(bud), rose_mat)
    parts.append(bud)

    for k in range(4):
        rim = radius * (0.3 + 0.23 * k) * (0.88 + 0.34 * openness)
        depth = radius * (0.46 - 0.07 * k)
        bpy.ops.mesh.primitive_cone_add(
            vertices=16,
            radius1=rim * 0.42,
            radius2=rim * (0.86 + 0.5 * openness),
            depth=depth,
            end_fill_type="NOTHING",
            location=(0, 0, radius * 0.06 + depth / 2 - k * radius * 0.06),
        )
        cup = bpy.context.object
        cup.name = f"Cup{idx}_{k}"
        solid = cup.modifiers.new("Solid", "SOLIDIFY")
        solid.thickness = 0.018
        cup.rotation_euler = (
            math.radians(5 * math.sin(idx * 1.3 + k)),
            math.radians(5 * math.cos(idx * 0.9 + k * 1.7)),
            math.radians(24 * k + 11 * idx),
        )
        assign(shade_smooth(cup), rose_mat)
        parts.append(cup)

    # outer petals: upright when closed, folded open when bloomed
    for i in range(5):
        a = 2 * math.pi * i / 5 + 0.4 * idx
        jitter = 0.9 + 0.2 * math.sin(idx * 2.7 + i * 1.9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius * 0.46 * jitter, segments=20, ring_count=12)
        p = bpy.context.object
        p.name = f"Petal{idx}_{i}"
        p.scale = (1.15, 0.17, 1.0)
        d = radius * (0.62 + 0.42 * openness)
        p.location = (math.cos(a) * d, math.sin(a) * d, radius * (0.16 - 0.5 * openness))
        p.rotation_euler = (
            math.radians((16 + 62 * openness) * jitter),
            math.radians(8 * math.sin(idx + i)),
            a - math.pi / 2,
        )
        assign(shade_smooth(p), rose_mat)
        parts.append(p)

    head = group(f"head{idx}", parts)
    head.location = CENTER + dome * direction
    head.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return parts, head


closed_parts, open_parts = [], []
heads = []
for idx, (spread, angle) in enumerate(HEAD_SPREAD):
    p, h = rose_head(idx, head_dir(spread, angle, 0.55), 0.76, 0.0)
    closed_parts += p
    heads.append(h)
    p, h = rose_head(100 + idx, head_dir(spread, angle, 1.45), 1.12, 1.0)
    open_parts += p
    heads.append(h)

hide_unless("closed", *closed_parts)
hide_unless("open", *open_parts)

# stems fanning out of the wrap toward each head
BASE = Vector((0, 0.1, -1.05))
stems = []
for spread, angle in HEAD_SPREAD:
    tip = CENTER + 0.72 * head_dir(spread, angle, 0.8)
    v = tip - BASE
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=v.length, vertices=10)
    s = bpy.context.object
    s.location = BASE + v * 0.5
    s.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
    assign(shade_smooth(s), stem_mat)
    stems.append(s)

# paper cone wrapping the stems, plus a flared collar for a folded look
WRAP_BOTTOM, WRAP_TOP = -1.72, 0.02
WRAP_R0, WRAP_R1 = 0.14, 0.92
bpy.ops.mesh.primitive_cone_add(
    vertices=9,
    radius1=WRAP_R0,
    radius2=WRAP_R1,
    depth=WRAP_TOP - WRAP_BOTTOM,
    location=(0, 0.06, (WRAP_TOP + WRAP_BOTTOM) / 2),
)
wrap = bpy.context.object
assign(bevel(wrap, 0.035, 3), paper_mat)

bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=0.7, radius2=1.02, depth=0.34, location=(0, 0.05, -0.04))
collar = bpy.context.object
collar.rotation_euler = (0, 0, math.radians(20))
assign(bevel(collar, 0.03, 3), paper_mat)

# gold ribbon tie, sitting on the paper surface, with two loops
TIE_Z = -0.6
tie_r = WRAP_R0 + (WRAP_R1 - WRAP_R0) * (TIE_Z - WRAP_BOTTOM) / (WRAP_TOP - WRAP_BOTTOM)
bpy.ops.mesh.primitive_torus_add(
    major_radius=tie_r + 0.05, minor_radius=0.075, major_segments=64, minor_segments=20, location=(0, 0.06, TIE_Z)
)
tie = bpy.context.object
tie.scale = (1.0, 1.0, 0.7)
assign(shade_smooth(tie), ribbon_mat)

loops = []
for sx in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.26,
        minor_radius=0.05,
        major_segments=48,
        minor_segments=16,
        location=(sx * (tie_r * 0.55), 0.06 - tie_r * 0.7, TIE_Z + 0.05),
    )
    lp = bpy.context.object
    lp.rotation_euler = (math.radians(90), math.radians(28 * sx), math.radians(-18 * sx))
    lp.scale = (1.0, 0.5, 1.0)
    assign(shade_smooth(lp), ribbon_mat)
    loops.append(lp)

# leaves peeking out between the roses and the paper
leaves = []
for i, (a, zz, tilt) in enumerate(((-45, 0.28, 62), (38, 0.2, 66), (168, 0.12, 72), (104, 0.34, 54))):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.34, segments=18, ring_count=10)
    lf = bpy.context.object
    lf.name = f"Leaf{i}"
    lf.scale = (0.4, 0.07, 1.0)
    ar = math.radians(a)
    lf.location = (math.cos(ar) * 1.0, 0.18 + math.sin(ar) * 0.45, zz)
    lf.rotation_euler = (math.radians(tilt), 0, ar - math.pi / 2)
    assign(shade_smooth(lf), leaf_mat)
    leaves.append(lf)

# one warm spark on the ribbon knot
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=(0.12, 0.06 - tie_r - 0.06, TIE_Z + 0.06))
glint = bpy.context.object
assign(glint, emissive("Glint", (1.0, 0.86, 0.55, 1), 26))
glint.visible_shadow = False

root = group("bouquet", [wrap, collar, tie, glint, *heads, *stems, *loops, *leaves])

studio_lights(scale=1.5, target=(0, 0, 0.25))
camera(distance=9.2, height=1.1, lens=72, target=(0, 0, 0.12))
render(root)
