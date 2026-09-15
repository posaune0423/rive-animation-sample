"""指輪 5,000 — gold band, four prongs, one small brilliant stone. Turntable friendly."""

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
    gold,
    group,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
)

sc = reset_scene()

# band: torus standing up, slightly D-profile via scale
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.13, major_segments=128, minor_segments=48)
band = bpy.context.object
band.scale = (1, 1, 1.25)
band.rotation_euler = (math.radians(90), 0, 0)
assign(shade_smooth(band), gold("BandGold", roughness=0.14))

# head / setting
bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=0.22, vertices=48, location=(0, 0, 1.1))
head = bpy.context.object
assign(bevel(shade_smooth(head), 0.03, 4), gold("HeadGold", roughness=0.2))

prongs = []
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.045, depth=0.36, vertices=16, location=(math.cos(a) * 0.23, math.sin(a) * 0.23, 1.3)
    )
    p = bpy.context.object
    p.rotation_euler = (math.radians(12) * math.sin(a), -math.radians(12) * math.cos(a), 0)
    assign(shade_smooth(p), gold("ProngGold", roughness=0.2))
    prongs.append(p)

# stone: crown (truncated cone) + pavilion (cone)
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.30, radius2=0.19, depth=0.13, location=(0, 0, 1.365))
crown = bpy.context.object
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.30, radius2=0.0, depth=0.30, location=(0, 0, 1.15))
pav = bpy.context.object
pav.rotation_euler = (math.pi, 0, 0)
stone_mat = diamond()
assign(shade_smooth(crown), stone_mat)
assign(pav, stone_mat)
# a small glint so the stone reads even against the dark video
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0.08, -0.16, 1.44))
glint = bpy.context.object
assign(glint, emissive("Glint", (1, 1, 1, 1), 40))
glint.visible_shadow = False

root = group("ring", [band, head, crown, pav, glint, *prongs])
root.rotation_euler = (0, 0, 0)

# The ring spans z -1.41 (band bottom) to 1.5 (stone tip); aim at its middle and stand far enough
# back that the whole band fits with a margin, or the band is clipped by the bottom of the frame.
studio_lights(scale=1.0, target=(0, 0, 0.2))
camera(distance=7.45, height=1.5, lens=85, target=(0, 0, 0.05))
render(root)
