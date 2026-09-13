"""ダイヤ — one brilliant-cut diamond, tilted so table and pavilion both read. Turntable."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    bevel,
    camera,
    diamond,
    emissive,
    group,
    render,
    reset_scene,
    studio_lights,
)

sc = reset_scene()

FACETS = 16
R = 1.0  # girdle radius
TABLE = 0.50 * R
CROWN_H = 0.42
GIRDLE_H = 0.08
PAV_H = 1.06

stone = diamond()
# a little more see-through than the default so facets refract instead of reading as white plastic
stone.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.7

# crown: truncated cone from the girdle up to the flat table
bpy.ops.mesh.primitive_cone_add(
    vertices=FACETS, radius1=R, radius2=TABLE, depth=CROWN_H, location=(0, 0, GIRDLE_H / 2 + CROWN_H / 2)
)
crown = bpy.context.object
assign(bevel(crown, 0.035, 2), stone)

# girdle: thin band holding crown and pavilion apart
bpy.ops.mesh.primitive_cylinder_add(vertices=FACETS, radius=R, depth=GIRDLE_H, location=(0, 0, 0))
girdle = bpy.context.object
assign(girdle, stone)

# pavilion: cone tapering to the culet
bpy.ops.mesh.primitive_cone_add(
    vertices=FACETS, radius1=R, radius2=0.0, depth=PAV_H, location=(0, 0, -GIRDLE_H / 2 - PAV_H / 2)
)
pav = bpy.context.object
pav.rotation_euler = (math.pi, 0, math.pi / FACETS)  # half-facet offset, as on a real brilliant
assign(bevel(pav, 0.03, 2), stone)

# the turntable spins this group on the stone's own axis, so every frame keeps the same silhouette
spin = group("diamond", [crown, girdle, pav])

# glints stay put while the facets turn under them, like fixed specular highlights
glints = []
for loc, r, s in (((-0.34, -0.55, 0.34), 0.05, 45), ((0.5, -0.5, -0.2), 0.032, 30)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc)
    g = bpy.context.object
    assign(g, emissive("Glint", (1, 1, 1, 1), s))
    g.visible_shadow = False
    glints.append(g)

tilt = group("diamondTilt", [spin, *glints])
tilt.rotation_euler = (math.radians(-24), 0, 0)  # table and pavilion both show

studio_lights(scale=1.0, target=(0, 0, -0.05))
camera(distance=6.8, height=0.45, lens=80, target=(0, 0, -0.08))
render(spin)
