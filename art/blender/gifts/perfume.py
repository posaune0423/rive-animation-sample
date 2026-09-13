"""香水 — beveled glass flacon full of amber liquid, gold collar, lifting cap. Front 3/4 view."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    amber_liquid,
    assign,
    bevel,
    camera,
    champagne_gold,
    emissive,
    glass,
    gold,
    group,
    hide_unless,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
)

sc = reset_scene()


def box(name, half, loc, bevel_w=0.08, segments=5):
    """A cuboid whose bevel stays even: the size goes into the mesh, not the object scale."""
    bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o = bpy.context.object
    o.name = name
    for v in o.data.vertices:
        v.co = (v.co.x * half[0], v.co.y * half[1], v.co.z * half[2])
    return bevel(o, bevel_w, segments)


BODY = (0.86, 0.42, 1.12)  # half extents
TOP = BODY[2]

body = box("Body", BODY, (0, 0, 0), 0.14, 6)
assign(body, glass("FlaconGlass", color=(0.98, 0.95, 0.88, 1), roughness=0.01))

# liquid: an inner cuboid filled to roughly two thirds
LIQ_TOP = 0.42
LIQ_H = (LIQ_TOP + BODY[2] - 0.06) / 2
liquid = box("Liquid", (BODY[0] - 0.07, BODY[1] - 0.07, LIQ_H), (0, 0, LIQ_TOP - LIQ_H), 0.1, 5)
assign(liquid, amber_liquid("Juice"))

# neck + gold collar
bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.26, vertices=48, location=(0, 0, TOP + 0.11))
neck = bpy.context.object
assign(shade_smooth(neck), glass("NeckGlass", color=(0.98, 0.95, 0.88, 1), roughness=0.02))

bpy.ops.mesh.primitive_cylinder_add(radius=0.31, depth=0.2, vertices=64, location=(0, 0, TOP + 0.19))
collar = bpy.context.object
assign(bevel(shade_smooth(collar), 0.03, 4), gold("CollarGold", roughness=0.14))

# cap: gold-rimmed champagne block that lifts off the collar
cap = box("Cap", (0.36, 0.3, 0.3), (0, 0, TOP + 0.6), 0.08, 6)
assign(cap, champagne_gold("CapGold"))
bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=0.07, vertices=64, location=(0, 0, TOP + 0.33))
cap_rim = bpy.context.object
assign(bevel(shade_smooth(cap_rim), 0.02, 3), gold("CapRim", roughness=0.2))

# a warm spark on the collar edge so the gold reads on a dark video
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(-0.2, -0.26, TOP + 0.26))
glint = bpy.context.object
assign(glint, emissive("Glint", (1.0, 0.88, 0.6, 1), 30))
glint.visible_shadow = False

hide_unless("bottle", body, liquid, neck, collar, glint)
hide_unless("cap", cap, cap_rim)

root = group("perfume", [body, liquid, neck, collar, cap, cap_rim, glint])
root.rotation_euler = (0, 0, math.radians(36))

studio_lights(scale=1.2, target=(0, 0, 0.3))
camera(distance=8.4, height=1.6, lens=80, target=(0, 0, 0.42))
render(root)
