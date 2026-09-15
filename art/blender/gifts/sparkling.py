"""シャンパン — a dark green glass bottle with gold foil and a plain cream label.

Parts: `bottle` = glass + foil + label, `cork` = the gold cap on the neck.
The body is lathed from a profile so the shoulder curve stays smooth at icon size.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from common import (  # noqa: E402
    assign,
    bottle_green_glass,
    camera,
    champagne_gold,
    cream_lacquer,
    group,
    hide_unless,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
)

sc = reset_scene()


def lathe(name, profile, segments=96):
    """Revolve a (radius, z) profile around Z. Radius 0 makes a pole vertex (a cap)."""
    verts, rings = [], []
    for r, z in profile:
        if r <= 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        ring = []
        for s in range(segments):
            a = 2 * math.pi * s / segments
            ring.append(len(verts))
            verts.append((r * math.cos(a), r * math.sin(a), z))
        rings.append(ring)

    faces = []
    for lower, upper in zip(rings, rings[1:]):
        if len(lower) == 1:
            for s in range(segments):
                faces.append((lower[0], upper[(s + 1) % segments], upper[s]))
        elif len(upper) == 1:
            for s in range(segments):
                faces.append((upper[0], lower[s], lower[(s + 1) % segments]))
        else:
            for s in range(segments):
                t = (s + 1) % segments
                faces.append((lower[s], lower[t], upper[t], upper[s]))

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    sc.collection.objects.link(obj)
    return shade_smooth(obj)


BOTTLE_PROFILE = [
    (0.00, -1.13),
    (0.26, -1.14),
    (0.365, -1.09),
    (0.385, -0.98),
    (0.385, -0.34),
    (0.378, -0.18),
    (0.345, -0.02),
    (0.275, 0.16),
    (0.205, 0.30),
    (0.170, 0.44),
    (0.158, 0.62),
    (0.154, 0.92),
    (0.156, 1.00),
    (0.182, 1.03),
    (0.184, 1.09),
    (0.150, 1.11),
    (0.00, 1.11),
]

bottle = lathe("bottleGlass", BOTTLE_PROFILE)
assign(bottle, bottle_green_glass("BottleGreen"))

# gold foil: a sleeve over the neck, flaring slightly where it meets the shoulder
FOIL_PROFILE = [
    (0.00, 1.115),
    (0.155, 1.115),
    (0.190, 1.09),
    (0.192, 1.02),
    (0.165, 0.99),
    (0.163, 0.62),
    (0.178, 0.44),
    (0.214, 0.30),
    (0.214, 0.27),
    (0.178, 0.41),
    (0.150, 0.62),
    (0.150, 1.09),
    (0.00, 1.09),
]
foil = lathe("bottleFoil", FOIL_PROFILE)
assign(foil, champagne_gold("FoilGold"))

# thin gold band marking the bottom edge of the foil
band = lathe(
    "foilBand",
    [(0.215, 0.255), (0.232, 0.245), (0.232, 0.205), (0.215, 0.195), (0.212, 0.225), (0.215, 0.255)],
)
assign(band, champagne_gold("BandGold"))


def arc_panel(name, radius, z0, z1, half_angle, mat, segments=40, thickness=0.014):
    verts, faces = [], []
    for i in range(segments + 1):
        a = math.radians(-90) + (-half_angle + 2 * half_angle * i / segments)
        verts.append((radius * math.cos(a), radius * math.sin(a), z0))
        verts.append((radius * math.cos(a), radius * math.sin(a), z1))
    for i in range(segments):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    sc.collection.objects.link(obj)
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    return assign(shade_smooth(obj), mat)


LABEL = cream_lacquer("LabelCream")
LABEL.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.55, 0.49, 0.40, 1)
label = arc_panel("bottleLabel", 0.388, -0.66, -0.10, math.radians(54), LABEL)

# --- cork / cap --------------------------------------------------------------------------------
CORK_PROFILE = [
    (0.00, 1.10),
    (0.175, 1.10),
    (0.196, 1.16),
    (0.205, 1.28),
    (0.196, 1.37),
    (0.150, 1.42),
    (0.00, 1.435),
]
cork = lathe("cork", CORK_PROFILE)
assign(cork, champagne_gold("CorkGold"))

bottle_part = [bottle, foil, band, label]
cork_part = [cork]
hide_unless("bottle", *bottle_part)
hide_unless("cork", *cork_part)

root = group("sparkling", [*bottle_part, *cork_part])
root.rotation_euler = (0, math.radians(-8), 0)

studio_lights(scale=1.0, target=(0, 0, 0.1))
camera(distance=6.4, height=1.0, lens=78, target=(0, 0, 0.12))
render(root)
