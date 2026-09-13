"""夜の宮殿 — a palace silhouette rising from the bottom of a portrait frame.

Deep night-blue masonry, darker roofs, gold finials and many lit windows, with a faint moon
above-left. The centre of the frame stays empty for the streamer, so the two outer towers carry
the height and the central tower tops out just below the face area.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import bpy  # noqa: E402
from common import (  # noqa: E402
    RES,
    RES_Y,
    assign,
    camera,
    emissive,
    gold,
    group,
    night_matte,
    render,
    reset_scene,
    shade_smooth,
    studio_lights,
)

sc = reset_scene()
random.seed(23)

H = 10.0
W = H * (RES / RES_Y)


def fx(u):
    return (u - 0.5) * W


def fz(v):
    return (v - 0.5) * H


STONE = night_matte("Stone", (0.022, 0.030, 0.085, 1))
STONE_HI = night_matte("StoneHi", (0.034, 0.044, 0.110, 1))
ROOF = night_matte("Roof", (0.009, 0.012, 0.034, 1))
GOLD = gold("PalaceGold", roughness=0.2)
WIN = emissive("Window", (1.0, 0.84, 0.52, 1), 6.0)
WIN_SOFT = emissive("WindowSoft", (1.0, 0.78, 0.44, 1), 3.5)

objs = []
win_quads = []


def box(name, u0, u1, v0, v1, y0, y1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    x0, x1, z0, z1 = fx(u0), fx(u1), fz(v0), fz(v1)
    o.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    assign(o, mat)
    objs.append(o)
    return o


def windows(u0, u1, v0, v1, cols, rows, y, wu=0.010, hv=0.012, lit=0.78, keep_clear=None):
    for c in range(cols):
        for r in range(rows):
            cu = u0 + (u1 - u0) * (c + 0.5) / cols
            cv = v0 + (v1 - v0) * (r + 0.5) / rows
            if keep_clear and keep_clear[0] < cu < keep_clear[1] and cv < keep_clear[2]:
                continue
            if random.random() > lit:
                continue
            x0, x1 = fx(cu - wu), fx(cu + wu)
            z0, z1 = fz(cv - hv), fz(cv + hv)
            win_quads.append([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)])


def spire(name, u_c, v_base, v_tip, half_u, y, mat=ROOF):
    r = abs(fx(u_c + half_u) - fx(u_c))
    d = fz(v_tip) - fz(v_base)
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=r, radius2=0.0, depth=d, location=(fx(u_c), y, fz(v_base) + d / 2)
    )
    c = bpy.context.object
    c.name = name
    assign(c, mat)
    objs.append(c)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.22, location=(fx(u_c), y, fz(v_tip) + r * 0.2))
    ball = bpy.context.object
    ball.name = name + "Finial"
    assign(shade_smooth(ball), GOLD)
    objs.append(ball)
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=r * 0.09, radius2=0.0, depth=r * 0.5,
        location=(fx(u_c), y, fz(v_tip) + r * 0.2 + r * 0.34),
    )
    tip = bpy.context.object
    tip.name = name + "Tip"
    assign(tip, GOLD)
    objs.append(tip)


def tower(name, u_c, half_u, v_top, v_spire, y, mat=STONE, v_win=0.10):
    box(name, u_c - half_u, u_c + half_u, -0.06, v_top, y, y + 0.9, mat)
    box(name + "Cornice", u_c - half_u * 1.22, u_c + half_u * 1.22, v_top, v_top + 0.012, y - 0.12, y + 0.9, ROOF)
    spire(name + "Spire", u_c, v_top + 0.012, v_spire, half_u * 1.18, y + 0.45)
    rows = max(3, int((v_top - 0.06) / 0.042))
    windows(u_c - half_u * 0.66, u_c + half_u * 0.66, v_win, v_top - 0.03, 2, rows, y - 0.01, 0.0095, 0.012, lit=0.7)


# main body ---------------------------------------------------------------------------------------
box("body", 0.07, 0.93, -0.06, 0.275, 0.0, 0.9, STONE)
box("bodyCornice", 0.055, 0.945, 0.275, 0.292, -0.15, 0.9, ROOF)
box("bodyTrim", 0.055, 0.945, 0.268, 0.276, -0.16, -0.1, GOLD)
box("wingL", 0.03, 0.24, -0.06, 0.20, -0.35, 0.55, STONE_HI)
box("wingR", 0.76, 0.97, -0.06, 0.20, -0.35, 0.55, STONE_HI)
box("wingLCornice", 0.018, 0.252, 0.20, 0.216, -0.45, 0.55, ROOF)
box("wingRCornice", 0.748, 0.982, 0.20, 0.216, -0.45, 0.55, ROOF)
windows(0.10, 0.90, 0.05, 0.258, 30, 6, -0.02, 0.0085, 0.011, lit=0.62, keep_clear=(0.42, 0.58, 0.19))
windows(0.045, 0.235, 0.03, 0.185, 8, 4, -0.37, 0.0095, 0.012, lit=0.72)
windows(0.765, 0.955, 0.03, 0.185, 8, 4, -0.37, 0.0095, 0.012, lit=0.72)

# gate --------------------------------------------------------------------------------------------
gx0, gx1 = fx(0.445), fx(0.555)
gz0, gz1 = fz(-0.02), fz(0.125)
win_quads_gate = [[(gx0, -0.46, gz0), (gx1, -0.46, gz0), (gx1, -0.46, gz1), (gx0, -0.46, gz1)]]
bpy.ops.mesh.primitive_cylinder_add(
    radius=abs(gx1 - gx0) / 2, depth=0.06, vertices=32, location=((gx0 + gx1) / 2, -0.46, gz1)
)
arch = bpy.context.object
arch.name = "gateArch"
arch.rotation_euler = (math.radians(90), 0, 0)
assign(shade_smooth(arch), WIN_SOFT)
objs.append(arch)
gate = bpy.data.meshes.new("gate")
gate.from_pydata([v for q in win_quads_gate for v in q], [], [(0, 1, 2, 3)])
gate.update()
gate_o = bpy.data.objects.new("gate", gate)
sc.collection.objects.link(gate_o)
assign(gate_o, WIN_SOFT)
objs.append(gate_o)
box("gateFrameL", 0.432, 0.445, -0.06, 0.15, -0.56, -0.44, GOLD)
box("gateFrameR", 0.555, 0.568, -0.06, 0.15, -0.56, -0.44, GOLD)
box("gateLintel", 0.418, 0.582, 0.185, 0.198, -0.57, -0.44, GOLD)

# towers ------------------------------------------------------------------------------------------
tower("towerL", 0.10, 0.068, 0.405, 0.505, -0.55)
tower("towerR", 0.90, 0.068, 0.405, 0.505, -0.55)
tower("midL", 0.265, 0.052, 0.295, 0.345, -0.42, STONE_HI)
tower("midR", 0.735, 0.052, 0.295, 0.345, -0.42, STONE_HI)
tower("towerC", 0.50, 0.075, 0.265, 0.330, -0.3, v_win=0.155)

w_mesh = bpy.data.meshes.new("windows")
verts, faces = [], []
for q in win_quads:
    i = len(verts)
    verts.extend(q)
    faces.append((i, i + 1, i + 2, i + 3))
w_mesh.from_pydata(verts, [], faces)
w_mesh.update()
w_obj = bpy.data.objects.new("windows", w_mesh)
sc.collection.objects.link(w_obj)
assign(w_obj, WIN)
objs.append(w_obj)

# moon --------------------------------------------------------------------------------------------
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.42, location=(fx(0.135), 6.0, fz(0.795)), segments=48, ring_count=24)
m = bpy.context.object
m.name = "moon"
m.visible_shadow = False
assign(shade_smooth(m), emissive("Moon", (0.84, 0.9, 1.0, 1), 2.4))
objs.append(m)

root = group("palace", objs)
studio_lights(scale=1.9, target=(0, 0, fz(0.25)))
camera(distance=22.0, height=0.0, ortho=True, ortho_scale=H, target=(0, 0, 0))
render(root)
