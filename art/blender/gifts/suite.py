"""スイートルーム — a luxury hotel window.

Three parts. `frame` and `curtain` share one orthographic portrait camera; `icon` is its own
square vignette of the same window. The middle of the portrait stays empty (the streamer is
behind it): only the jambs, the head and the sill are drawn, plus the rod across the top.

`curtain` is authored as the LEFT panel; the app mirrors it for the right side and slides both
outward by 95 px of 390, so the panel runs well past the left edge and stays attached when open.
"""

import math
import os
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
    group,
    hide_unless,
    principled,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
    velvet,
)

sc = reset_scene()

ICON = PART == "icon"
H = 2.2 if ICON else 10.0
W = H if ICON else H * (RES / RES_Y)
# Unit for how far mouldings step towards the camera. Keeps the icon's proportions.
S = 0.22 if ICON else 1.0


def fx(u):
    """0 = left edge, 1 = right edge."""
    return (u - 0.5) * W


def fz(v):
    """0 = bottom edge, 1 = top edge."""
    return (v - 0.5) * H


# ---- primitives --------------------------------------------------------------------------------


def box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    return assign(o, mat)


def cyl(name, r, length, loc, axis, mat, verts=64):
    """A round member: `axis` is the direction it runs in ('x' horizontal, 'z' vertical)."""
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, vertices=verts, location=loc)
    o = bpy.context.object
    o.name = name
    if axis == "x":
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == "y":
        o.rotation_euler = (math.radians(90), 0, 0)
    return assign(shade_smooth(o), mat)


def ball(name, r, loc, mat, segments=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=segments, ring_count=segments // 2)
    o = bpy.context.object
    o.name = name
    return assign(shade_smooth(o), mat)


def ring(name, major, minor, loc, mat, flat=1.0):
    """A torus standing in the XZ plane (threaded onto a horizontal rod)."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=48, minor_segments=14, location=loc
    )
    o = bpy.context.object
    o.name = name
    o.rotation_euler = (math.radians(90), 0, 0)
    o.scale = (1, 1, flat)
    return assign(shade_smooth(o), mat)


# ---- materials ---------------------------------------------------------------------------------


def _noise_chain(m, scale, detail=8.0, freq=5.0):
    nt = m.node_tree
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = scale
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = freq
    noise.inputs["Detail"].default_value = detail
    noise.inputs["Roughness"].default_value = 0.7
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    return nt, noise


def brushed_gold(name, rough=(0.07, 0.30), tint=(0.40, 0.25, 0.09), streak=(26.0, 26.0, 1.3), bump=0.16):
    """Warm gold, brushed along the length of the member.

    The shared rig is bright enough that plain gold facing the camera mirrors the fill light and
    reads as flat cream, so the base colour is tuned well down and the roughness is broken up by a
    stretched noise: the streak keeps a moving specular instead of one even fill.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*tint, 1)
    b.inputs["Metallic"].default_value = 1.0
    nt, noise = _noise_chain(m, streak)
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = 0.33
    rng.inputs["From Max"].default_value = 0.67
    rng.inputs["To Min"].default_value = rough[0]
    rng.inputs["To Max"].default_value = rough[1]
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = bump
    bmp.inputs["Distance"].default_value = 0.01
    nt.links.new(noise.outputs["Fac"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], b.inputs["Roughness"])
    nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])
    return m


def grained_wood(name, color, roughness=0.62, coat=0.0):
    """Dark stained wood with a faint grain so the flats are not one even gradient."""
    m = principled(
        name,
        **{"Base Color": (*color, 1), "Roughness": roughness, "Coat Weight": coat, "Specular IOR Level": 0.2},
    )
    nt, noise = _noise_chain(m, (18.0, 6.0, 0.5), detail=6.0, freq=4.0)
    b = nt.nodes["Principled BSDF"]
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = 0.35
    rng.inputs["From Max"].default_value = 0.65
    rng.inputs["To Min"].default_value = max(0.12, roughness - 0.14)
    rng.inputs["To Max"].default_value = roughness + 0.16
    bmp = nt.nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.08
    bmp.inputs["Distance"].default_value = 0.01
    nt.links.new(noise.outputs["Fac"], rng.inputs["Value"])
    nt.links.new(rng.outputs["Result"], b.inputs["Roughness"])
    nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"])
    nt.links.new(bmp.outputs["Normal"], b.inputs["Normal"])
    return m


WOOD = grained_wood("Wood", (0.013, 0.0048, 0.0022))
WOOD_DARK = grained_wood("WoodDark", (0.005, 0.0018, 0.0009), roughness=0.8)
# The front-most rounds (beads, nosing) are a shade lighter so the profile steps read apart.
WOOD_BEAD = grained_wood("WoodBead", (0.050, 0.021, 0.009), roughness=0.46)
GOLD_ROD = brushed_gold("GoldRod")
GOLD_TRIM = brushed_gold("GoldTrim", rough=(0.10, 0.34), streak=(30.0, 30.0, 1.1))
GOLD_TIE = brushed_gold("GoldTie", rough=(0.12, 0.38), tint=(0.46, 0.30, 0.12))


# ---- window members ----------------------------------------------------------------------------


def jamb(name, x_out, x_in, z0, z1):
    """A moulded upright, three depths: recessed casing, a raised panel band, a bullnose bead
    standing proudest of all, and a thin gold liner along the edge of the opening."""
    sgn = 1.0 if x_in > x_out else -1.0
    w = abs(x_in - x_out)
    zc, zl = (z0 + z1) / 2, abs(z1 - z0)

    def at(f):
        return x_out + sgn * f * w

    back = box(name + "Back", x_out, x_in, -0.18 * S, 0.62 * S, z0, z1, WOOD_DARK)
    band = box(name + "Band", at(0.12), at(0.56), -0.40 * S, -0.18 * S, z0, z1, WOOD)
    bevel(band, 0.02 * S, 3)
    reed = cyl(name + "Reed", 0.085 * w, zl, (at(0.26), -0.44 * S, zc), "z", WOOD)
    bead = cyl(name + "Bead", 0.13 * w, zl, (at(0.76), -0.55 * S, zc), "z", WOOD_BEAD)
    liner = cyl(name + "Liner", 0.045 * w, zl, (at(0.97), -0.30 * S, zc), "z", GOLD_TRIM)
    return [back, band, reed, bead, liner]


def head(name, x0, x1, z_low, z_high):
    """The head casing above the opening: the jamb profile lying down."""
    h = abs(z_high - z_low)
    xc, xl = (x0 + x1) / 2, abs(x1 - x0)
    back = box(name + "Back", x0, x1, -0.18 * S, 0.62 * S, z_low, z_high, WOOD_DARK)
    band = box(name + "Band", x0, x1, -0.46 * S, -0.18 * S, z_low + 0.45 * h, z_high, WOOD)
    bevel(band, 0.02 * S, 3)
    bead = cyl(name + "Bead", 0.16 * h, xl, (xc, -0.55 * S, z_low + 0.22 * h), "x", WOOD_BEAD)
    liner = cyl(name + "Liner", 0.032 * h, xl, (xc, -0.62 * S, z_low + 0.01 * h), "x", GOLD_TRIM)
    return [back, band, bead, liner]


def sill(name, x0, x1, z_bot, z_top):
    """Apron, a slab that projects past the jambs, and a bullnose nosing at the top front edge
    where the key light rakes across it."""
    h = abs(z_top - z_bot)
    xc, xl = (x0 + x1) / 2, abs(x1 - x0)
    apron = box(name + "Apron", x0, x1, -0.20 * S, 0.58 * S, z_bot, z_top - 0.55 * h, WOOD_DARK)
    slab = box(
        name + "Slab",
        x0 - 0.02 * xl,
        x1 + 0.02 * xl,
        -0.70 * S,
        0.50 * S,
        z_top - 0.58 * h,
        z_top - 0.14 * h,
        WOOD,
    )
    bevel(slab, 0.04 * S, 4)
    nose = cyl(name + "Nose", 0.13 * h, xl * 1.05, (xc, -0.76 * S, z_top - 0.15 * h), "x", WOOD_BEAD)
    liner = cyl(name + "Liner", 0.038 * h, xl * 1.05, (xc, -0.82 * S, z_top - 0.34 * h), "x", GOLD_TRIM)
    return [apron, slab, nose, liner]


def curtain_rod(name, x0, x1, z, y, r):
    """Round rod with a turned finial at each end."""
    objs = [cyl(name, r, abs(x1 - x0), ((x0 + x1) / 2, y, z), "x", GOLD_ROD)]
    for x, sgn in ((x0, -1), (x1, 1)):
        objs.append(cyl(name + "Collar", r * 1.45, r * 0.5, (x + sgn * r * 0.25, y, z), "x", GOLD_ROD))
        objs.append(ball(name + "Finial", r * 1.65, (x + sgn * r * 1.5, y, z), GOLD_ROD))
        objs.append(ball(name + "Tip", r * 0.7, (x + sgn * r * 2.7, y, z), GOLD_ROD))
    return objs


def bracket(name, x, z, y_rod, y_wall, r):
    """A stub arm back to the wall plus a collar around the rod."""
    arm = cyl(name + "Arm", r * 0.45, abs(y_wall - y_rod), (x, (y_rod + y_wall) / 2, z), "y", GOLD_ROD)
    plate = cyl(name + "Plate", r * 0.9, r * 0.4, (x, y_wall, z), "y", GOLD_ROD)
    collar = ring(name + "Collar", r * 1.25, r * 0.3, (x, y_rod, z), GOLD_ROD)
    return [arm, plate, collar]


# ---- curtain -----------------------------------------------------------------------------------


def curtain_panel(name, x_out, x_in, z_bot, z_top, folds=7, depth=0.5, tie_t=0.42, nx=140, nz=56):
    """A hanging velvet panel: vertical folds, gathered into tighter pleats at the heading,
    pinched where the tieback holds it, falling wider again below."""
    verts, faces = [], []
    for j in range(nz + 1):
        t = j / nz
        z = z_bot + (z_top - z_bot) * t
        pinch = math.exp(-(((t - tie_t) / 0.10) ** 2))
        gather = 1.0 + 0.55 * math.exp(-(((t - 1.0) / 0.075) ** 2))
        amp = depth * (0.52 + 0.48 * (1.0 - t)) * gather * (1.0 - 0.5 * pinch)
        wfac = (0.90 + 0.10 * t) * (1.0 - 0.26 * pinch)
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
    mat = velvet("CurtainVelvet" + name, (0.055, 0.006, 0.015, 1))
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = 0.3
    b.inputs["Sheen Tint"].default_value = (0.55, 0.12, 0.16, 1)
    return assign(o, mat)


def sash(name, x, y, z, major, minor, squash=0.62):
    """A tieback loop lying flat around the panel: in front at the middle, behind at the sides."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=64, minor_segments=14, location=(x, y, z)
    )
    o = bpy.context.object
    o.name = name
    o.scale = (1, squash, 1)
    return assign(shade_smooth(o), GOLD_TIE)


def heading_rings(name, x_out, x_in, z_rod, y_rod, r_rod, count):
    """Rings threaded on the rod, each with a short hanger tab down into the pleats."""
    objs = []
    for k in range(count):
        u = (k + 0.5) / count
        x = x_out + (x_in - x_out) * u
        objs.append(ring("%sRing%d" % (name, k), r_rod * 1.7, r_rod * 0.26, (x, y_rod, z_rod), GOLD_TIE))
        objs.append(
            cyl(
                "%sTab%d" % (name, k),
                r_rod * 0.3,
                r_rod * 1.5,
                (x, y_rod + r_rod * 0.8, z_rod - r_rod * 2.3),
                "z",
                GOLD_TIE,
            )
        )
    return objs


# ---- scenes ------------------------------------------------------------------------------------

if ICON:
    # Small square vignette of the same window, readable at 128 px.
    x_l, x_r = -0.90, 0.90
    jw = 0.22
    z_bot, z_top = -0.76, 0.86
    rod_z, rod_r, rod_y = 0.545, 0.058, -0.34 * S
    objs = []
    objs += jamb("jambL", x_l, x_l + jw, -0.58, 0.70)
    objs += jamb("jambR", x_r, x_r - jw, -0.58, 0.70)
    # the head sits ON the jambs and no wider, or it reads as a slab floating above the window
    objs += head("head", x_l, x_r, 0.665, z_top)
    objs += sill("sill", x_l, x_r, z_bot, -0.56)
    objs += curtain_rod("rod", x_l + 0.17, x_r - 0.17, rod_z, rod_y, rod_r)
    for sgn in (-1, 1):
        side = "L" if sgn < 0 else "R"
        x_o, x_i = sgn * 0.74, sgn * 0.20
        objs.append(
            curtain_panel(
                "curtain" + side, x_o, x_i, -0.565, rod_z - rod_r * 1.15, folds=4.25, depth=0.26, tie_t=0.34
            )
        )
        objs += heading_rings("hd" + side, x_o + sgn * 0.04, x_i * 0.92, rod_z, rod_y, rod_r, 3)
        tie_z = -0.565 + (rod_z - rod_r * 1.15 + 0.565) * 0.34
        objs.append(sash("tie" + side, sgn * 0.58, -0.02, tie_z, 0.19, 0.019, squash=0.85))
    root = group("suiteIcon", objs)
    studio_lights(scale=1.35, target=(0, -0.12, 0))
    camera(distance=8.0, height=0.0, ortho=True, ortho_scale=H * 0.94, target=(0, 0, 0.02))
else:
    # --- frame -------------------------------------------------------------------------------
    jamb_u = 0.118
    rod_z, rod_r, rod_y = fz(0.884), 0.115, -0.86 * S
    frame_objs = []
    # top and bottom stop behind the head band and the sill slab, so no trim line runs past them
    frame_objs += jamb("jambL", fx(-0.03), fx(jamb_u), fz(0.035), fz(0.99))
    frame_objs += jamb("jambR", fx(1.03), fx(1.0 - jamb_u), fz(0.035), fz(0.99))
    frame_objs += head("head", fx(-0.03), fx(1.03), fz(0.962), fz(1.03))
    frame_objs += sill("sill", fx(-0.03), fx(1.03), fz(-0.03), fz(0.108))
    frame_objs += curtain_rod("rod", fx(0.10), fx(0.90), rod_z, rod_y, rod_r)
    for u in (0.115, 0.885):
        frame_objs += bracket("brk%d" % int(u * 100), fx(u), rod_z, rod_y, -0.22 * S, rod_r)

    # --- curtain -----------------------------------------------------------------------------
    # The panel runs far past the left edge so a 95/390 slide never pulls it off the jamb.
    c_out, c_in = fx(-0.32), fx(0.46)
    c_top, c_bot = rod_z - rod_r * 1.15, fz(0.135)
    curtain = curtain_panel("curtainL", c_out, c_in, c_bot, c_top, folds=8.75, depth=0.85, nz=64)
    rings = heading_rings("hdL", c_out + 0.10, c_in, rod_z, rod_y, rod_r, 9)

    tie_z = c_bot + (c_top - c_bot) * 0.42
    tie = sash("tieback", fx(0.02), -0.02, tie_z, W * 0.24, 0.055, squash=0.85)
    knot = ball("knot", 0.115, (fx(0.215), -0.50, tie_z - 0.02), GOLD_TIE)
    curtain_objs = [curtain, tie, knot, *rings]

    hide_unless("frame", *frame_objs)
    hide_unless("curtain", *curtain_objs)
    root = group("suite", [*frame_objs, *curtain_objs])
    studio_lights(scale=1.7, target=(0, -0.5, 0))
    camera(distance=22.0, height=0.0, ortho=True, ortho_scale=H, target=(0, 0, 0))

render(root)
