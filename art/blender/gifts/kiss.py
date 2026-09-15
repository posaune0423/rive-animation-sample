"""キスマーク — a glossy crimson lipstick kiss: upper and lower lip, nothing else."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    bevel,
    camera,
    crimson_gloss,
    group,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    subsurf,
)

sc = reset_scene()

N = 96  # samples per lip edge


def edge(fn, a=-1.0, b=1.0, n=N):
    return [(a + (b - a) * i / (n - 1), fn(a + (b - a) * i / (n - 1))) for i in range(n)]


def lip_curve(name, top_fn, bottom_fn, extrude, round_width, dome_factor):
    """A closed outline between two profiles, filled and rounded into a plump 3D lip."""
    outline = edge(top_fn) + list(reversed(edge(bottom_fn)))[1:-1]
    cu = bpy.data.curves.new(name + "Curve", "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.resolution_u = 3
    cu.extrude = extrude
    sp = cu.splines.new("POLY")
    sp.points.add(len(outline) - 1)
    for i, (x, y) in enumerate(outline):
        sp.points[i].co = (x, y, 0.0, 1.0)
    sp.use_cyclic_u = True
    sp.use_smooth = True
    obj = bpy.data.objects.new(name, cu)
    sc.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    bevel(obj, round_width, 8)
    # the curve fill is a fan of thin triangles; remesh it into an even surface before smoothing
    remesh = obj.modifiers.new("Remesh", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.014
    subsurf(obj, 1)
    # dome the flat faces so each lip is a plump pillow rather than a slab
    cast = obj.modifiers.new("Cast", "CAST")
    cast.cast_type = "SPHERE"
    cast.factor = dome_factor
    return shade_smooth(obj)


def dome(x, height, power):
    return height * max(0.0, 1.0 - x * x) ** power


# upper lip: two humps with a cupid's bow dip in the middle
upper = lip_curve(
    "lipUpper",
    lambda x: dome(x, 0.50, 0.55) * (1.0 - 0.46 * math.exp(-((x / 0.30) ** 2))),
    lambda x: -dome(x, 0.03, 1.0),
    extrude=0.105,
    round_width=0.10,
    dome_factor=0.45,
)
# lower lip: one fuller hump, parted from the upper one by a thin dark gap
lower = lip_curve(
    "lipLower",
    lambda x: -dome(x, 0.105, 0.6),
    lambda x: -dome(x, 0.56, 0.6),
    extrude=0.125,
    round_width=0.12,
    dome_factor=0.3,
)

mat = crimson_gloss("KissCrimson")
# brighter than the heart, but still pigmented enough not to wash out under the studio key
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.40, 0.03, 0.075, 1)
bsdf.inputs["Roughness"].default_value = 0.30
bsdf.inputs["Specular IOR Level"].default_value = 0.42
bsdf.inputs["Coat Weight"].default_value = 0.5
bsdf.inputs["Coat Roughness"].default_value = 0.12
for o in (upper, lower):
    assign(o, mat)
    o.scale = (1.8, 1.55, 1.3)
    o.rotation_euler = (math.radians(84), 0, 0)

root = group("kiss", [upper, lower])
root.rotation_euler = (0, math.radians(-7), 0)

studio_lights(scale=1.0, target=(0, 0, 0))
camera(distance=6.8, height=0.85, lens=85, target=(0, 0, -0.05))
render(root)
