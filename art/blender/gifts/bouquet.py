"""花束 — nine layered-petal roses with foliage in folded paper. `closed` = buds, `open` = bloom.

Both parts share one camera, one wrap, one ribbon, one set of stems and identical head positions:
only the petals of each head change (scale + how far they fold open), so the cross-fade blooms.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402
from common import (  # noqa: E402
    assign,
    camera,
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

# ---- materials ---------------------------------------------------------------------------------
# The shared rig is bright, so petals stay dark and nearly specular-free; the tonal range comes
# from the ring they sit in (cupped centre dark, outer petals a touch brighter) plus self-shadowing.


def petal_mat(name, color):
    return principled(
        name,
        **{
            "Base Color": color,
            "Roughness": 0.80,
            "Specular IOR Level": 0.02,
            "Sheen Weight": 0.06,
            "Sheen Roughness": 0.60,
        },
    )


ROSE_MATS = [
    petal_mat("RoseCore", (0.105, 0.008, 0.020, 1)),
    petal_mat("RoseInner", (0.135, 0.009, 0.025, 1)),
    petal_mat("RoseMid", (0.150, 0.010, 0.027, 1)),
    petal_mat("RoseOuter", (0.205, 0.013, 0.036, 1)),
    petal_mat("RoseEdge", (0.280, 0.022, 0.055, 1)),
]

leaf_mats = [
    principled(
        "LeafDark",
        **{"Base Color": (0.018, 0.052, 0.022, 1), "Roughness": 0.55, "Specular IOR Level": 0.3, "Sheen Weight": 0.2},
    ),
    principled(
        "LeafLit",
        **{"Base Color": (0.035, 0.088, 0.034, 1), "Roughness": 0.5, "Specular IOR Level": 0.35, "Sheen Weight": 0.2},
    ),
]
stem_mat = principled("Stem", **{"Base Color": (0.026, 0.055, 0.026, 1), "Roughness": 0.62})
paper_mat = principled(
    "Paper",
    **{
        "Base Color": (0.095, 0.072, 0.108, 1),
        "Roughness": 0.94,
        "Specular IOR Level": 0.12,
        "Sheen Weight": 0.22,
        "Sheen Roughness": 0.45,
    },
)
paper_inner_mat = velvet("PaperInner", (0.030, 0.022, 0.038, 1))
ribbon_mat = gold("Ribbon", roughness=0.42)
ribbon_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.36, 0.25, 0.10, 1)

# ---- surface builder ----------------------------------------------------------------------------


def surface(name, fn, nu=10, nv=12, mat=None):
    """A smooth-shaded quad grid; `fn(u, v)` maps u in [-1,1] (across) and v in [0,1] (along)."""
    verts = [fn(-1 + 2 * i / nu, j / nv) for j in range(nv + 1) for i in range(nu + 1)]
    faces = [
        (j * (nu + 1) + i, j * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i + 1, (j + 1) * (nu + 1) + i)
        for j in range(nv)
        for i in range(nu)
    ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    shade_smooth(o)
    if mat is not None:
        assign(o, mat)
    return o


def petal_fn(length, width, cup, bend, roll):
    """Base at the origin, tip toward +Z, width along Y, cupping toward -X (the flower axis)."""

    def f(u, v):
        hw = width * (1 - (1 - v) ** 2.2) ** 0.5 * (1 - 0.5 * max(0.0, (v - 0.70) / 0.30) ** 2.4)
        y = u * hw
        # edges wrap inward around the axis, the whole petal leans out, the outer edge rolls back
        x = -cup * u * u * hw + bend * v * v * length + roll * (u**4) * (v**1.6) * hw
        z = v * length - 0.22 * cup * u * u * hw
        return (x, y, z)

    return f


def leaf_fn(length, width, fold, curve, droop):
    """A pointed blade folded along its midrib and curving over."""

    def f(u, v):
        hw = width * math.sin(math.pi * min(1.0, v**0.8)) ** 0.75 + 0.012 * width
        y = u * hw
        x = -fold * (0.45 * abs(u) + 0.55 * u * u) * hw + curve * v * v * length
        z = v * length - droop * v * v * length
        return (x, y, z)

    return f


# ---- one rose ------------------------------------------------------------------------------------
# (count, ring radius, tilt°, length, width, cup, bend, roll, base z, material index)
RINGS = [
    (3, 0.030, 5, 0.220, 0.200, 0.85, -0.30, 0.00, 0.055, 0),
    (5, 0.075, 14, 0.265, 0.225, 0.68, -0.18, 0.04, 0.035, 1),
    (6, 0.160, 38, 0.330, 0.240, 0.50, 0.02, 0.22, 0.000, 2),
    (7, 0.255, 64, 0.380, 0.252, 0.38, 0.15, 0.30, -0.040, 3),
    (7, 0.335, 90, 0.372, 0.260, 0.30, 0.20, 0.38, -0.085, 4),
]

ROSE_SIZE = 1.10


def rose(idx, openness, shade=0, size=ROSE_SIZE):
    """Layered petals in spiralling rings; `openness` 0 = bud wrapped shut, 1 = full bloom."""
    r = random.Random(1000 + idx % 100)
    parts = []

    # receptacle so the very centre is never a hole
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07 * size, segments=16, ring_count=10)
    core = bpy.context.object
    core.name = f"Core{idx}"
    core.scale = (1.0, 1.0, 1.5)
    core.location = (0, 0, 0.05 * size)
    assign(shade_smooth(core), ROSE_MATS[0])
    parts.append(core)

    for k, (count, rad, tilt, length, width, cup, bend, roll, z0, mi) in enumerate(RINGS):
        # closed: rings pull upright and inward, petals cup tighter, no rolled-back edge
        open_k = min(1.0, openness * (0.62 + 0.38 * k / (len(RINGS) - 1)))
        rad_k = rad * (0.46 + 0.54 * open_k) * size
        tilt_k = math.radians(tilt) * (0.10 + 0.90 * open_k)
        cup_k = cup * (1.60 - 0.60 * open_k)
        bend_k = bend * (0.4 + 0.6 * open_k) - 0.10 * (1 - open_k)
        roll_k = roll * open_k
        phase = r.uniform(0, math.tau) + k * 0.82
        for i in range(count):
            a = math.tau * i / count + phase
            j = r.uniform(0.9, 1.12)
            p = surface(
                f"P{idx}_{k}_{i}",
                petal_fn(length * size * j, width * size * j, cup_k, bend_k, roll_k),
                mat=ROSE_MATS[max(0, min(len(ROSE_MATS) - 1, mi + shade + (1 if r.random() < 0.3 else 0)))],
            )
            p.location = (
                math.cos(a) * rad_k,
                math.sin(a) * rad_k,
                z0 * size * (0.4 + 0.6 * open_k) + r.uniform(-0.012, 0.012) * size,
            )
            p.rotation_euler = (
                r.uniform(-0.05, 0.05),
                tilt_k + r.uniform(-0.06, 0.06) * open_k,
                a + r.uniform(-0.12, 0.12),
            )
            parts.append(p)

    # green calyx peeking out under the outermost petals
    for i in range(4):
        a = math.tau * i / 4 + r.uniform(0, 1.2)
        sep = surface(
            f"Sep{idx}_{i}",
            leaf_fn(0.30 * size, 0.055 * size, 0.9, 0.35, 0.0),
            nu=6,
            nv=8,
            mat=leaf_mats[0],
        )
        sep.location = (math.cos(a) * 0.16 * size, math.sin(a) * 0.16 * size, -0.11 * size)
        sep.rotation_euler = (0, math.radians(118 + 16 * r.random()), a)
        parts.append(sep)

    return parts, group(f"head{idx}", parts)


# ---- bouquet layout -------------------------------------------------------------------------------
# Heads sit on a dome facing the camera (camera looks along +Y). Positions are identical in both
# parts — only petal openness and head scale change — so the cross-fade reads as blooming.
FACE = Vector((0, -0.72, 0.70)).normalized()
RIGHT = Vector((1, 0, 0))
UP = FACE.cross(RIGHT).normalized()
CENTER = Vector((0, 0.16, 0.38))
DOME = 0.80

LAYOUT = [(0.0, 0.0)]
for i in range(4):
    LAYOUT.append((1.02, math.tau * i / 4 + math.radians(38)))
for i in range(4):
    LAYOUT.append((1.84, math.tau * i / 4 + math.radians(-42)))


def head_dir(spread, angle):
    return (FACE + spread * 0.60 * (math.cos(angle) * RIGHT + math.sin(angle) * UP)).normalized()


def place(head, idx, spread, angle, scale):
    r = random.Random(500 + idx)
    d = head_dir(spread, angle)
    # push each head off the dome normal a little so some read as turned or tilted away
    lean = Euler((r.uniform(-0.30, 0.30), r.uniform(-0.26, 0.26), 0)).to_quaternion()
    q = d.to_track_quat("Z", "Y") @ lean @ Euler((0, 0, r.uniform(0, math.tau))).to_quaternion()
    head.location = CENTER + (DOME + r.uniform(-0.07, 0.07)) * d
    head.rotation_euler = q.to_euler()
    s = scale * r.uniform(0.80, 1.14)
    head.scale = (s, s, s)


closed_parts, open_parts, heads = [], [], []
for idx, (spread, angle) in enumerate(LAYOUT):
    # heads on the outer ring sit further back, so they get one step darker petals
    p, h = rose(idx, 0.0, shade=-1 if spread > 1.0 else 0)
    place(h, idx, spread, angle, 0.74)  # buds: ~3/4 of the bloomed head
    closed_parts += p
    heads.append(h)
    p, h = rose(100 + idx, 1.0, shade=-1 if spread > 1.0 else 0)
    # 0.90 rather than 1.0: at full size the nine heads merge into one ruffled mass and you stop
    # reading individual roses, which is the whole point of the bloom
    place(h, idx, spread, angle, 0.90)
    open_parts += p
    heads.append(h)

hide_unless("closed", *closed_parts)
hide_unless("open", *open_parts)

# ---- stems ---------------------------------------------------------------------------------------
BASE = Vector((0, 0.10, -1.10))
stems = []
for idx, (spread, angle) in enumerate(LAYOUT):
    r = random.Random(900 + idx)
    tip = CENTER + (DOME - 0.16) * head_dir(spread, angle)
    cu = bpy.data.curves.new(f"stem{idx}", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.028
    cu.bevel_resolution = 3
    cu.resolution_u = 6
    sp = cu.splines.new("POLY")
    sp.points.add(3)
    bow = Vector((r.uniform(-0.10, 0.10), r.uniform(-0.06, 0.02), 0))
    for t, pt in zip((0.0, 0.34, 0.7, 1.0), sp.points):
        p = BASE.lerp(tip, t) + bow * math.sin(math.pi * t)
        pt.co = (p.x, p.y, p.z, 1)
    s = bpy.data.objects.new(f"Stem{idx}", cu)
    sc.collection.objects.link(s)
    assign(s, stem_mat)
    stems.append(s)

# ---- foliage tucked between and behind the heads ---------------------------------------------------
leaves = []
for i, (a, spread, tilt, size) in enumerate(
    (
        (-58, 2.15, 106, 1.15),
        (34, 2.20, 110, 1.05),
        (150, 2.05, 100, 1.20),
        (-140, 2.00, 104, 1.00),
        (96, 2.35, 120, 0.90),
        (-16, 2.40, 124, 0.82),
    )
):
    r = random.Random(300 + i)
    d = head_dir(spread, math.radians(a))
    lf = surface(
        f"Leaf{i}",
        leaf_fn(0.78 * size, 0.19 * size, 0.75, 0.42, 0.30),
        nu=8,
        nv=12,
        mat=leaf_mats[i % 2],
    )
    q = d.to_track_quat("Z", "Y") @ Euler((0, math.radians(tilt - 100), r.uniform(0, math.tau))).to_quaternion()
    lf.location = CENTER + (DOME + 0.02) * d
    lf.rotation_euler = q.to_euler()
    leaves.append(lf)

# small sprigs of two leaves poking above the red mass
for i, (a, spread) in enumerate(((-95, 1.7), (70, 1.75), (172, 1.6))):
    r = random.Random(400 + i)
    d = head_dir(spread, math.radians(a))
    base = CENTER + (DOME - 0.25) * d
    tip = base + d * 0.34 + Vector((r.uniform(-0.10, 0.10), 0, 0.05))
    cu = bpy.data.curves.new(f"sprig{i}", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.016
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(2)
    for t, pt in zip((0.0, 0.5, 1.0), sp.points):
        p = base.lerp(tip, t)
        pt.co = (p.x, p.y, p.z, 1)
    st = bpy.data.objects.new(f"Sprig{i}", cu)
    sc.collection.objects.link(st)
    assign(st, stem_mat)
    leaves.append(st)
    for k in range(2):
        lf = surface(
            f"SprigLeaf{i}_{k}",
            leaf_fn(0.26, 0.080, 0.8, 0.35, 0.15),
            nu=6,
            nv=9,
            mat=leaf_mats[1],
        )
        lf.location = base.lerp(tip, 0.55 + 0.35 * k)
        lf.rotation_euler = (
            d.to_track_quat("Z", "Y")
            @ Euler((0, math.radians(58 + 14 * k), math.pi * k + r.uniform(0, 0.6))).to_quaternion()
        ).to_euler()
        leaves.append(lf)

for i in range(7):
    a = math.tau * i / 7 + 0.35
    r = random.Random(700 + i)
    lf = surface(
        f"Collar{i}",
        leaf_fn(0.62 * r.uniform(0.85, 1.15), 0.155, 0.8, 0.45, 0.28),
        nu=8,
        nv=12,
        mat=leaf_mats[i % 2],
    )
    lf.location = (math.cos(a) * 0.42, 0.06 + math.sin(a) * 0.42, 0.10)
    lf.rotation_euler = (0, math.radians(56 + 16 * r.random()), a)
    leaves.append(lf)

# ---- paper wrap: a folded cone with an uneven, flared top edge ---------------------------------------
TIE_T = 0.60  # height of the ribbon along the cone, 0 = tip, 1 = rim
WRAP_BOTTOM, WRAP_TOP = -1.46, 0.18
WRAP_R0, WRAP_R1 = 0.09, 0.90
FOLDS = 11
NTH, NZ = 132, 28


def wrap_vert(th, t):
    """t 0..1 from tip to rim. Radius flares near the rim; the folds deepen as the paper opens."""
    flare = t**1.18 + 0.12 * t**6
    rad = WRAP_R0 + (WRAP_R1 - WRAP_R0) * flare
    rad *= 1.0 + (0.065 + 0.095 * t) * math.cos(FOLDS * th) + 0.022 * math.cos(2 * FOLDS * th + 0.7)
    rad *= 1.0 - 0.10 * math.exp(-(((t - TIE_T) / 0.10) ** 2))  # cinched under the ribbon
    z = WRAP_BOTTOM + (WRAP_TOP - WRAP_BOTTOM) * t
    z += (0.075 * math.sin(FOLDS * th + 0.5) + 0.04 * math.sin(2 * th + 1.3)) * t**4
    return (math.cos(th) * rad, 0.06 + math.sin(th) * rad, z)


wrap_verts = [wrap_vert(math.tau * i / NTH, j / NZ) for j in range(NZ + 1) for i in range(NTH)]
wrap_faces = [
    (j * NTH + i, j * NTH + (i + 1) % NTH, (j + 1) * NTH + (i + 1) % NTH, (j + 1) * NTH + i)
    for j in range(NZ)
    for i in range(NTH)
]
wrap_mesh = bpy.data.meshes.new("Wrap")
wrap_mesh.from_pydata(wrap_verts, [], wrap_faces)
wrap_mesh.update()
wrap = bpy.data.objects.new("Wrap", wrap_mesh)
sc.collection.objects.link(wrap)
shade_smooth(wrap)
wrap.data.materials.append(paper_mat)
wrap.data.materials.append(paper_inner_mat)
solid = wrap.modifiers.new("Solid", "SOLIDIFY")
solid.thickness = 0.024
solid.offset = 1.0
solid.material_offset = 1
solid.material_offset_rim = 1

# ---- gold tie with a small bow -----------------------------------------------------------------------
TIE_Z = WRAP_BOTTOM + (WRAP_TOP - WRAP_BOTTOM) * TIE_T
tie_r = (WRAP_R0 + (WRAP_R1 - WRAP_R0) * (TIE_T**1.18 + 0.12 * TIE_T**6)) * 0.93
bpy.ops.mesh.primitive_torus_add(
    major_radius=tie_r, minor_radius=0.055, major_segments=72, minor_segments=18, location=(0, 0.06, TIE_Z)
)
tie = bpy.context.object
tie.scale = (1.0, 1.0, 0.55)
assign(shade_smooth(tie), ribbon_mat)

KNOT = Vector((0, 0.06 - tie_r * 0.92, TIE_Z))
bow = []
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, segments=20, ring_count=12, location=KNOT)
knot = bpy.context.object
knot.scale = (1.1, 0.7, 0.9)
assign(shade_smooth(knot), ribbon_mat)
bow.append(knot)

for sx in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.23,
        minor_radius=0.038,
        major_segments=48,
        minor_segments=14,
        location=KNOT + Vector((sx * 0.22, -0.02, 0.05)),
    )
    lp = bpy.context.object
    lp.rotation_euler = (math.radians(86), math.radians(26 * sx), math.radians(-16 * sx))
    lp.scale = (1.0, 0.45, 0.78)
    assign(shade_smooth(lp), ribbon_mat)
    bow.append(lp)

    tail = surface(
        f"Tail{sx}",
        lambda u, v, sx=sx: (
            sx * (0.13 * v + 0.16 * v * v) + u * 0.10 * (1 - 0.25 * v) * math.cos(1.2 * v),
            -0.04 * v - 0.03 * v * v,
            -0.26 * v - 0.20 * v * v + u * 0.06 * (1 - 0.25 * v) * math.sin(1.2 * v),
        ),
        nu=6,
        nv=10,
        mat=ribbon_mat,
    )
    tail.location = KNOT + Vector((sx * 0.05, 0.0, -0.03))
    bow.append(tail)

root = group("bouquet", [wrap, tie, *bow, *heads, *stems, *leaves])

studio_lights(scale=1.5, target=(0, 0, 0.3))
camera(distance=9.2, height=1.5, lens=72, target=(0, 0, 0.10))
render(root)
