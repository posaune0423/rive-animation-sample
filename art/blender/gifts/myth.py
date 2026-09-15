"""神話 — a golden sunburst medallion seen head-on.

Concentric gold rings (polished / brushed), 20 radiating spikes, gem studs and a faceted crystal
with a glowing core. Orthographic and centred so the animation can rotate and scale it freely.
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
    champagne_gold,
    crimson_gloss,
    deep_red_lacquer,
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

objs = []
POLISHED = gold("GoldPolished", roughness=0.13)
BRUSHED = champagne_gold("GoldBrushed")
_b = BRUSHED.node_tree.nodes["Principled BSDF"]
_b.inputs["Roughness"].default_value = 0.34
_b.inputs["Base Color"].default_value = (0.98, 0.76, 0.38, 1)
RAY_GOLD = gold("RayGold", roughness=0.18)


def ring(name, major, minor, mat, y=0.0, flatten=0.7):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=128, minor_segments=32, location=(0, y, 0)
    )
    o = bpy.context.object
    o.name = name
    o.rotation_euler = (math.radians(90), 0, 0)
    o.scale = (1, 1, flatten)  # local Z becomes the view axis after the X rotation
    objs.append(assign(shade_smooth(o), mat))
    return o


# backing plate: dark lacquer so the gold reads against it instead of the video --------------------
bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.10, vertices=96, location=(0, 0.09, 0))
plate = bpy.context.object
plate.name = "plate"
plate.rotation_euler = (math.radians(90), 0, 0)
plate_mat = deep_red_lacquer("PlateRed")
_p = plate_mat.node_tree.nodes["Principled BSDF"]
_p.inputs["Base Color"].default_value = (0.075, 0.005, 0.012, 1)
_p.inputs["Roughness"].default_value = 0.35
_p.inputs["Coat Roughness"].default_value = 0.25
assign(bevel(plate, 0.015, 3), plate_mat)
objs.append(plate)

# radiating spikes --------------------------------------------------------------------------------
N = 20
for i in range(N):
    a = 2 * math.pi * i / N
    long_ray = i % 2 == 0
    r0, r1 = 0.44, (0.86 if long_ray else 0.70)
    rc = (r0 + r1) / 2
    bpy.ops.mesh.primitive_cone_add(
        vertices=4,
        radius1=0.062 if long_ray else 0.042,
        radius2=0.0,
        depth=r1 - r0,
        location=(math.cos(a) * rc, 0.045, math.sin(a) * rc),
    )
    ray = bpy.context.object
    ray.name = "ray%02d" % i
    ray.scale = (1, 0.42, 1)
    ray.rotation_euler = (0, math.pi / 2 - a, 0)
    objs.append(assign(ray, RAY_GOLD))

# rings -------------------------------------------------------------------------------------------
ring("ringOuter", 0.545, 0.048, POLISHED, y=0.0, flatten=0.75)
ring("ringStud", 0.455, 0.030, BRUSHED, y=-0.03, flatten=0.9)
ring("ringInner", 0.320, 0.055, POLISHED, y=-0.05, flatten=0.7)
ring("ringBezel", 0.235, 0.040, BRUSHED, y=-0.09, flatten=0.9)

# gem studs ---------------------------------------------------------------------------------------
RED = crimson_gloss("StudRed")
RED.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.22, 0.012, 0.035, 1)
for i in range(16):
    a = 2 * math.pi * i / 16 + math.pi / 16
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2, radius=0.036, location=(math.cos(a) * 0.455, -0.055, math.sin(a) * 0.455)
    )
    stud = bpy.context.object
    stud.name = "stud%02d" % i
    stud.scale = (1, 0.75, 1)
    objs.append(assign(stud, RED if i % 2 else BRUSHED))

# central crystal ---------------------------------------------------------------------------------
GEM = diamond("CoreGem")
_g = GEM.node_tree.nodes["Principled BSDF"]
_g.inputs["Transmission Weight"].default_value = 0.88
_g.inputs["Base Color"].default_value = (0.88, 0.94, 1.0, 1)
bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.190, radius2=0.085, depth=0.13, location=(0, -0.12, 0))
crown = bpy.context.object
crown.name = "crown"
crown.rotation_euler = (math.radians(90), 0, 0)
objs.append(assign(crown, GEM))

bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.190, radius2=0.0, depth=0.22, location=(0, 0.065, 0))
pav = bpy.context.object
pav.name = "pavilion"
pav.rotation_euler = (math.radians(90), 0, 0)
objs.append(assign(pav, GEM))

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.062, location=(0, 0.10, 0))
core = bpy.context.object
core.name = "core"
core.visible_shadow = False
objs.append(assign(shade_smooth(core), emissive("Core", (1.0, 0.84, 0.52, 1), 12.0)))

bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028, location=(-0.075, -0.2, 0.075))
glint = bpy.context.object
glint.name = "glint"
glint.visible_shadow = False
objs.append(assign(glint, emissive("Glint", (1, 1, 1, 1), 45.0)))

root = group("myth", objs)
studio_lights(scale=1.1, target=(0, 0, 0))
camera(distance=8.0, height=0.0, ortho=True, ortho_scale=2.0, target=(0, 0, 0))
render(root)
