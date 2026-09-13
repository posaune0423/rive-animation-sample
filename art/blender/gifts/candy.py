"""お菓子 — a cream lacquer gift box with a gold ribbon and a bow.

Parts: `box` = body + the ribbon on the body, `lid` = lid + its ribbon + the bow.
In `all` the lid sits closed on the body, so the two parts stack pixel-perfectly.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    bevel,
    camera,
    cream_lacquer,
    gold,
    group,
    hide_unless,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
)

sc = reset_scene()

CREAM = cream_lacquer("BoxCream")
GOLD = gold("RibbonGold", roughness=0.32)  # rougher gold keeps the shaded side reading gold, not black


def slab(name, size, loc, mat, bevel_width=0.02, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    assign(bevel(o, bevel_width, 5), mat)
    return o


# --- body --------------------------------------------------------------------------------------
body = slab("boxBody", (0.78, 0.78, 0.45), (0, 0, -0.45), CREAM, 0.035)
band_x = slab("boxBandX", (0.795, 0.115, 0.455), (0, 0, -0.45), GOLD, 0.02)
band_y = slab("boxBandY", (0.115, 0.795, 0.455), (0, 0, -0.45), GOLD, 0.02)

# --- lid ---------------------------------------------------------------------------------------
lid = slab("boxLid", (0.84, 0.84, 0.15), (0, 0, 0.15), CREAM, 0.035)
lid_x = slab("lidBandX", (0.855, 0.12, 0.155), (0, 0, 0.15), GOLD, 0.02)
lid_y = slab("lidBandY", (0.12, 0.855, 0.155), (0, 0, 0.15), GOLD, 0.02)

# bow: two flattened torus loops, a knot and two short tails
loops = []
for sign in (1, -1):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.23,
        minor_radius=0.048,
        major_segments=72,
        minor_segments=20,
        location=(sign * 0.25, 0.02, 0.36),
        rotation=(0, math.radians(-18) * sign, math.radians(24) * sign),
    )
    loop = bpy.context.object
    loop.name = f"bowLoop{sign}"
    loop.scale = (1.0, 0.6, 1.0)
    assign(shade_smooth(loop), GOLD)
    loops.append(loop)

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, segments=48, ring_count=24, location=(0, 0.0, 0.355))
knot = bpy.context.object
knot.name = "bowKnot"
knot.scale = (1.0, 0.8, 0.85)
assign(shade_smooth(knot), GOLD)

tails = []
for sign in (1, -1):
    t = slab(
        f"bowTail{sign}",
        (0.22, 0.055, 0.035),
        (sign * 0.30, -0.16, 0.33),
        GOLD,
        0.015,
        rot=(0, math.radians(10) * sign, math.radians(-28) * sign),
    )
    tails.append(t)

box_part = [body, band_x, band_y]
lid_part = [lid, lid_x, lid_y, knot, *loops, *tails]
hide_unless("box", *box_part)
hide_unless("lid", *lid_part)

root = group("candy", [*box_part, *lid_part])
root.rotation_euler = (0, 0, math.radians(22))
root.scale = (1.0, 1.0, 1.0)

studio_lights(scale=1.0, target=(0, 0, -0.1))
camera(distance=4.9, height=2.7, lens=85, target=(0, 0, -0.15))
render(root)
