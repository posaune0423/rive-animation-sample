"""ハート — one plump deep-red lacquer heart, slightly tilted. T1 icon, bold silhouette."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    bevel,
    camera,
    deep_red_lacquer,
    group,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    subsurf,
)

sc = reset_scene()

# Classic heart outline; sampled as a poly spline so the curve bevel can round it into a pillow.
N = 320
pts = []
for i in range(N):
    t = 2 * math.pi * i / N
    pts.append((16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)))

xs = [p[0] for p in pts]
ys = [p[1] for p in pts]
scale = 1.62 / (max(ys) - min(ys))
cx = (max(xs) + min(xs)) / 2
cy = (max(ys) + min(ys)) / 2

cu = bpy.data.curves.new("HeartCurve", "CURVE")
cu.dimensions = "2D"
cu.fill_mode = "BOTH"
cu.resolution_u = 4
cu.extrude = 0.34

sp = cu.splines.new("POLY")
sp.points.add(N - 1)
for i, (x, y) in enumerate(pts):
    sp.points[i].co = ((x - cx) * scale, (y - cy) * scale, 0.0, 1.0)
sp.use_cyclic_u = True
sp.use_smooth = True

heart = bpy.data.objects.new("heart", cu)
sc.collection.objects.link(heart)

# the filled slab only exists once the curve is a mesh; bevel + subsurf then plump it up
bpy.context.view_layer.objects.active = heart
heart.select_set(True)
bpy.ops.object.convert(target="MESH")
heart = bpy.context.object
bevel(heart, 0.28, 8)
# the curve fill is a fan of thin triangles; remesh it into an even surface before smoothing
remesh = heart.modifiers.new("Remesh", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = 0.03
subsurf(heart, 1)
# cast the slab toward an ellipsoid so it becomes a pillow with no flat face to blow out
cast = heart.modifiers.new("Cast", "CAST")
cast.cast_type = "SPHERE"
cast.factor = 0.42
mat = deep_red_lacquer("HeartLacquer")
# the studio rig is bright: darken the pigment and spread the coat so the lacquer stays deep red
# instead of washing out to pink where the key and rim hit it
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.26, 0.02, 0.04, 1)
bsdf.inputs["Roughness"].default_value = 0.30
bsdf.inputs["Specular IOR Level"].default_value = 0.5
bsdf.inputs["Coat Weight"].default_value = 0.5
bsdf.inputs["Coat Roughness"].default_value = 0.15
assign(shade_smooth(heart), mat)
# stand it up facing the camera, then roll / yaw a little so the lacquer catches the key light
heart.rotation_euler = (math.radians(84), math.radians(12), math.radians(-30))

root = group("heart", [heart])

studio_lights(scale=1.0, target=(0, 0, 0))
camera(distance=5.8, height=1.0, lens=85, target=(0, 0, 0))
render(root)
