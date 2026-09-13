"""ぬいぐるみ — a huggable teddy bear plush: warm fur body, cream muzzle, dark eyes and nose."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    camera,
    cream_lacquer,
    fur,
    group,
    principled,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    subsurf,
)

sc = reset_scene()

# the studio rig is bright, so the pigments are kept dark to read as warm fur, not white plush
FUR = fur("BearFur", (0.20, 0.105, 0.045, 1))
INNER = fur("BearInner", (0.40, 0.26, 0.14, 1))
for m in (FUR, INNER):
    m.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.35
MUZZLE = cream_lacquer("Muzzle")
MUZZLE.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.52, 0.43, 0.33, 1)
MUZZLE.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.75
MUZZLE.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.0
DARK = principled("BearDark", **{"Base Color": (0.04, 0.03, 0.03, 1), "Roughness": 0.15, "Metallic": 0.0})


def blob(name, radius, loc, scale, mat, rot=(0, 0, 0), levels=2):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=48, ring_count=24, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    assign(subsurf(shade_smooth(o), levels), mat)
    return o


body = blob("body", 0.56, (0, 0, -0.36), (1.0, 0.88, 1.05), FUR)
belly = blob("belly", 0.40, (0, -0.34, -0.40), (1.0, 0.55, 0.85), INNER)
head = blob("head", 0.48, (0, 0, 0.48), (1.0, 0.94, 0.92), FUR)

ears = [blob(f"ear{s}", 0.175, (s * 0.38, 0.03, 0.83), (1.0, 0.62, 1.0), FUR) for s in (1, -1)]
inner_ears = [blob(f"earIn{s}", 0.105, (s * 0.39, -0.055, 0.82), (1.0, 0.5, 1.0), INNER) for s in (1, -1)]

muzzle = blob("muzzle", 0.235, (0, -0.36, 0.33), (1.0, 0.72, 0.72), MUZZLE)
nose = blob("nose", 0.095, (0, -0.50, 0.40), (1.0, 0.75, 0.72), DARK)
eyes = [blob(f"eye{s}", 0.072, (s * 0.185, -0.40, 0.60), (1.0, 0.8, 1.0), DARK, levels=1) for s in (1, -1)]

arms = [
    blob(
        f"arm{s}",
        0.215,
        (s * 0.56, -0.12, -0.23),
        (1.0, 0.85, 1.35),
        FUR,
        rot=(0, math.radians(38) * s, 0),
    )
    for s in (1, -1)
]
paws = [blob(f"paw{s}", 0.135, (s * 0.70, -0.20, -0.52), (1.0, 0.8, 0.9), INNER) for s in (1, -1)]
legs = [blob(f"leg{s}", 0.245, (s * 0.33, -0.16, -0.85), (1.15, 1.25, 0.82), FUR) for s in (1, -1)]
soles = [blob(f"sole{s}", 0.145, (s * 0.34, -0.40, -0.87), (1.0, 0.55, 0.85), INNER) for s in (1, -1)]

parts = [body, belly, head, muzzle, nose, *ears, *inner_ears, *eyes, *arms, *paws, *legs, *soles]
root = group("plush", parts)
root.rotation_euler = (0, 0, math.radians(-10))

studio_lights(scale=1.0, target=(0, 0, 0.1))
camera(distance=6.2, height=1.2, lens=80, target=(0, 0, 0.02))
render(root)
