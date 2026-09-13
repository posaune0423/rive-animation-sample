"""スイートルーム — a luxury hotel window at night.

Four parts sharing one orthographic portrait camera (except `icon`, which is its own square
vignette): `frame` (rail / pillars / sill), `skyline` (city + moon + stars), `curtain` (left velvet
panel). The centre of the portrait frame is left empty for the streamer.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    PART,
    RES,
    RES_Y,
    assign,
    bevel,
    camera,
    emissive,
    gold,
    group,
    hide_unless,
    night_matte,
    principled,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    velvet,
)

sc = reset_scene()
random.seed(11)

ICON = PART == "icon"
H = 2.2 if ICON else 10.0
W = H * (RES / RES_Y)


def fx(u):
    """0 = left edge, 1 = right edge."""
    return (u - 0.5) * W


def fz(v):
    """0 = bottom edge, 1 = top edge."""
    return (v - 0.5) * H


def box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    return assign(o, mat)


def quad_mesh(name, quads, mat):
    verts, faces = [], []
    for q in quads:
        i = len(verts)
        verts.extend(q)
        faces.append((i, i + 1, i + 2, i + 3))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    return assign(o, mat)


def deep_gold(name, roughness=0.28):
    """Gold tuned down: face-on metal otherwise mirrors the big fill light and reads cream."""
    return principled(name, **{"Base Color": (0.42, 0.27, 0.10, 1), "Metallic": 1.0, "Roughness": roughness})


WOOD = principled("Wood", **{"Base Color": (0.036, 0.013, 0.005, 1), "Roughness": 0.4, "Coat Weight": 0.3})
WOOD_DARK = principled("WoodDark", **{"Base Color": (0.013, 0.006, 0.003, 1), "Roughness": 0.55})
WIN_MATS = [
    emissive("Win1", (1.0, 0.82, 0.48, 1), 5.0),
    emissive("Win2", (1.0, 0.72, 0.36, 1), 7.5),
    emissive("Win3", (1.0, 0.90, 0.68, 1), 4.0),
]


def curtain_panel(name, x_out, x_in, z_bot, z_top, folds=7, depth=0.5, tie_t=0.42, nx=112, nz=44):
    """A hanging velvet panel: vertical sine folds, gathered at the top, pinched at the tieback."""
    verts, faces = [], []
    for j in range(nz + 1):
        t = j / nz
        z = z_bot + (z_top - z_bot) * t
        pinch = math.exp(-(((t - tie_t) / 0.10) ** 2))
        amp = depth * (0.45 + 0.55 * (1.0 - t)) * (1.0 - 0.5 * pinch)
        wfac = (0.90 + 0.10 * t) * (1.0 - 0.28 * pinch)
        for i in range(nx + 1):
            u = i / nx
            y = -amp * (0.5 - 0.5 * math.cos(u * folds * 2 * math.pi))
            y -= 0.14 * depth * math.sin(math.pi * u)
            verts.append((x_out + (x_in - x_out) * u * wfac, y, z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    shade_smooth(o)
    mod = o.modifiers.new("Solid", "SOLIDIFY")
    mod.thickness = 0.05 * (H / 10.0)
    mat = velvet("CurtainVelvet", (0.055, 0.006, 0.015, 1))
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = 0.3
    b.inputs["Sheen Tint"].default_value = (0.55, 0.12, 0.16, 1)
    return assign(o, mat)


def skyline_row(y, front, color, v_lo, v_hi, u0, u1, step, win_scale, v_base=-0.1):
    """Silhouettes marching across the bottom of the frame, with lit windows on the front face."""
    objs, quads = [], []
    mat = night_matte("Building%.0f" % (y * 10), color)
    u = u0
    while u < u1:
        w = random.uniform(step * 0.55, step * 1.25)
        hv = random.uniform(v_lo, v_hi)
        x0, x1 = fx(u), fx(min(u + w, u1 + 0.06))
        z1 = fz(hv)
        objs.append(box("bldg", x0, x1, y, y + 0.6, fz(v_base), z1, mat))
        cols = max(1, int((x1 - x0) / (0.135 * win_scale)))
        z_lo = fz(v_base + 0.08)
        rows = max(1, int((z1 - z_lo) / (0.20 * win_scale)))
        for c in range(cols):
            for r in range(rows):
                if random.random() > 0.52:
                    continue
                wx = x0 + (x1 - x0) * (c + 0.5) / cols
                wz = z_lo + (z1 - z_lo) * (r + 0.55) / (rows + 0.2)
                dx, dz = 0.045 * win_scale, 0.065 * win_scale
                quads.append(
                    [
                        (wx - dx, front, wz - dz),
                        (wx + dx, front, wz - dz),
                        (wx + dx, front, wz + dz),
                        (wx - dx, front, wz + dz),
                    ]
                )
        u += w + step * random.uniform(0.05, 0.3)
    for k in range(3):
        chunk = quads[k::3]
        if chunk:
            objs.append(quad_mesh("windows%d" % k, chunk, WIN_MATS[k]))
    return objs


def moon(x, z, r, y=6.0, strength=5.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=48, ring_count=24)
    m = bpy.context.object
    m.name = "moon"
    m.visible_shadow = False
    return assign(shade_smooth(m), emissive("Moon", (0.86, 0.91, 1.0, 1), strength))


def stars(n, v_lo, v_hi, y=6.0, rmin=0.018, rmax=0.038, skip=None):
    out = []
    mat = emissive("Star", (1.0, 0.97, 0.9, 1), 30.0)
    for _ in range(n):
        u = random.uniform(0.04, 0.96)
        v = random.uniform(v_lo, v_hi)
        if skip and skip(u, v):
            continue
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(rmin, rmax), location=(fx(u), y, fz(v)))
        s = bpy.context.object
        s.name = "star"
        s.visible_shadow = False
        out.append(assign(shade_smooth(s), mat))
    return out


if ICON:
    # --- compact square vignette -------------------------------------------------------------
    ring = deep_gold("IconGold", 0.3)
    f, tk = 0.88, 0.085
    op = f - tk  # inner opening
    frame_objs = [
        box("fTop", -f, f, -0.3, 0.3, op, f, ring),
        box("fBot", -f, f, -0.3, 0.3, -f, -op, ring),
        box("fL", -f, -op, -0.3, 0.3, -f, f, ring),
        box("fR", op, f, -0.3, 0.3, -f, f, ring),
    ]
    for o in frame_objs:
        bevel(o, 0.018, 3)
    v_lo = 0.5 - op / H
    cl = curtain_panel("curtainL", -op, -op * 0.42, -op, op, folds=2.25, depth=0.2)
    cr = curtain_panel("curtainR", op, op * 0.42, -op, op, folds=2.25, depth=0.2)
    sill = box("sill", -op, op, -0.34, -0.16, fz(v_lo), fz(v_lo) + 0.05, ring)
    rail = box("rail", -op, op, -0.34, -0.2, op - 0.06, op, ring)
    root = group("suiteIcon", [*frame_objs, cl, cr, sill, rail])
    studio_lights(scale=1.1, target=(0, 0, 0))
    camera(distance=8.0, height=0.0, ortho=True, ortho_scale=H, target=(0, 0, 0))
else:
    # --- frame ---------------------------------------------------------------------------------
    grail = deep_gold("RailGold", 0.24)
    pillar_l = box("pillarL", fx(-0.02), fx(0.095), -0.55, 0.35, fz(-0.05), fz(1.05), WOOD)
    pillar_r = box("pillarR", fx(1.02), fx(0.905), -0.55, 0.35, fz(-0.05), fz(1.05), WOOD)
    trim_l = box("trimL", fx(0.095), fx(0.104), -0.5, -0.1, fz(0.1), fz(0.99), deep_gold("TrimGold", 0.3))
    trim_r = box("trimR", fx(0.905), fx(0.896), -0.5, -0.1, fz(0.1), fz(0.99), deep_gold("TrimGold2", 0.3))
    header = box("header", fx(-0.02), fx(1.02), -0.45, 0.3, fz(0.965), fz(1.05), WOOD_DARK)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.075, depth=W * 1.02, vertices=32, location=(0, -0.42, fz(0.945)))
    rail = bpy.context.object
    rail.name = "rail"
    rail.rotation_euler = (0, math.radians(90), 0)
    assign(shade_smooth(rail), grail)
    finials = []
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, location=(sx * W * 0.505, -0.42, fz(0.945)))
        fin = bpy.context.object
        fin.name = "finial"
        finials.append(assign(shade_smooth(fin), grail))
    apron = box("apron", fx(-0.02), fx(1.02), -0.35, 0.3, fz(-0.05), fz(0.125), WOOD_DARK)
    ledge = box("ledge", fx(-0.02), fx(1.02), -0.62, 0.22, fz(0.125), fz(0.163), WOOD)
    bevel(ledge, 0.03, 4)
    ledge_trim = box("ledgeTrim", fx(-0.02), fx(1.02), -0.655, -0.61, fz(0.133), fz(0.152), deep_gold("LedgeGold", 0.3))
    frame_objs = [
        pillar_l,
        pillar_r,
        trim_l,
        trim_r,
        header,
        rail,
        apron,
        ledge,
        ledge_trim,
        *finials,
    ]

    # --- curtain -------------------------------------------------------------------------------
    curtain = curtain_panel("curtainL", fx(-0.01), fx(0.45), fz(0.135), fz(0.935), folds=5.25, depth=0.85)
    tie_z = fz(0.135) + (fz(0.935) - fz(0.135)) * 0.42
    bpy.ops.mesh.primitive_torus_add(
        major_radius=W * 0.215, minor_radius=0.055, major_segments=64, minor_segments=16,
        location=(fx(0.21), -0.18, tie_z),
    )
    tie = bpy.context.object
    tie.name = "tieback"
    tie.scale = (1, 0.5, 1)
    assign(shade_smooth(tie), deep_gold("TiebackGold", 0.26))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=(fx(0.44), -0.3, tie_z - 0.06))
    knot = bpy.context.object
    knot.name = "knot"
    assign(shade_smooth(knot), deep_gold("KnotGold", 0.28))
    curtain_objs = [curtain, tie, knot]

    hide_unless("frame", *frame_objs)
    hide_unless("curtain", *curtain_objs)
    root = group("suite", [*frame_objs, *curtain_objs])
    studio_lights(scale=1.7, target=(0, -0.4, 0))
    camera(distance=22.0, height=0.0, ortho=True, ortho_scale=H, target=(0, 0, 0))

render(root)
