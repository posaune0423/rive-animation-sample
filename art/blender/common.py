"""
Shared look for every gift render. Run through `art/render.ts`, never standalone.

Theme: night, gift, light. Transparent film, AgX view transform, one warm champagne key light,
one cold ice rim light, a soft fill, and a faint blue world so metals have something to reflect.
"""

import math
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default=None):
    for a in ARGS:
        if a.startswith(f"{name}="):
            return a.split("=", 1)[1]
    return default


OUT = arg("out")
FRAMES = int(arg("frames", "1"))
RES = int(arg("res", "1024"))
RES_Y = int(arg("resy", str(RES)))
SAMPLES = int(arg("samples", "256"))
TURNTABLE = arg("turntable", "0") == "1"
# Which part of a multi-part gift to render (e.g. candy: "box" / "lid"). Same camera every time.
PART = arg("part", "all")


def hide_unless(part_name, *objects):
    """Hide `objects` from the render unless PART is `all` or matches `part_name`."""
    hidden = PART not in ("all", part_name)
    for o in objects:
        o.hide_render = hidden
    return hidden


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.seed = 7
    sc.cycles.max_bounces = 8
    sc.cycles.transparent_max_bounces = 12
    sc.cycles.caustics_reflective = True
    sc.cycles.caustics_refractive = True
    sc.render.film_transparent = True
    sc.render.resolution_x = RES
    sc.render.resolution_y = RES_Y
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("Night")
    sc.world = world
    nt = world.node_tree
    bg = nt.nodes["Background"]
    bg.inputs[0].default_value = (0.03, 0.035, 0.08, 1)
    bg.inputs[1].default_value = 0.35
    return sc


def track(obj, target_loc=(0, 0, 0)):
    empty = bpy.data.objects.new(obj.name + "_target", None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = target_loc
    c = obj.constraints.new("TRACK_TO")
    c.target = empty
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


def area_light(name, loc, energy, color, size=2.0, target=(0, 0, 0)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    track(obj, target)
    return obj


def bounce_card(name, loc, rot, size, color=(1, 1, 1, 1), strength=2.0):
    """A softly emissive plane that shows up in reflections/refractions but not to the camera."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc, rotation=rot)
    card = bpy.context.object
    card.name = name
    assign(card, emissive(name + "Mat", color, strength))
    card.visible_camera = False
    card.visible_shadow = False
    return card


def studio_lights(scale=1.0, target=(0, 0, 0)):
    """Warm key from front-right-top, cold rim from back-left, soft fill from the front,
    plus two bounce cards so metals and gems have bright reflections to pick up."""
    area_light("key", (3 * scale, -3 * scale, 4 * scale), 900 * scale**2, (1.0, 0.86, 0.62), 2.2 * scale, target)
    area_light("rim", (-3.5 * scale, 3 * scale, 2.5 * scale), 650 * scale**2, (0.62, 0.76, 1.0), 2.0 * scale, target)
    area_light("fill", (0, -5 * scale, 0.6 * scale), 160 * scale**2, (1.0, 0.95, 0.9), 4.0 * scale, target)
    area_light("under", (0, 0, -4 * scale), 90 * scale**2, (1.0, 0.8, 0.5), 3.0 * scale, target)
    bounce_card("cardWarm", (2.5 * scale, 4 * scale, 1.5 * scale), (math.radians(80), 0, math.radians(-30)), 8 * scale, (1.0, 0.9, 0.7, 1), 1.6)
    bounce_card("cardCool", (-3 * scale, 3.5 * scale, 0.5 * scale), (math.radians(85), 0, math.radians(40)), 7 * scale, (0.75, 0.85, 1.0, 1), 1.4)
    bounce_card("cardTop", (0, 0, 7 * scale), (0, 0, 0), 6 * scale, (1, 1, 1, 1), 1.0)


def camera(distance=6.0, height=1.4, lens=70, target=(0, 0, 0), ortho=False, ortho_scale=3.0):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0, -distance, height)
    track(cam, target)
    bpy.context.scene.camera = cam
    return cam


# ---- materials -------------------------------------------------------------------------------


def principled(name, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def gold(name="Gold", roughness=0.16):
    return principled(name, **{"Base Color": (1.0, 0.72, 0.30, 1), "Metallic": 1.0, "Roughness": roughness})


def champagne_gold(name="Champagne"):
    return principled(name, **{"Base Color": (0.98, 0.83, 0.52, 1), "Metallic": 1.0, "Roughness": 0.22})


def deep_red_lacquer(name="Red"):
    return principled(
        name,
        **{"Base Color": (0.55, 0.05, 0.10, 1), "Roughness": 0.18, "Coat Weight": 1.0, "Coat Roughness": 0.05},
    )


def crimson_gloss(name="Crimson"):
    return principled(
        name,
        **{"Base Color": (0.75, 0.10, 0.22, 1), "Roughness": 0.12, "Coat Weight": 1.0, "Coat Roughness": 0.03},
    )


def glass(name="Glass", color=(0.95, 0.98, 1.0, 1), ior=1.5, roughness=0.02):
    return principled(
        name,
        **{"Base Color": color, "Transmission Weight": 1.0, "Roughness": roughness, "IOR": ior},
    )


def diamond(name="Diamond"):
    """Reads bright against a dark video: mostly glass, but with a white glossy base and a
    coat so facets keep specular highlights instead of showing the dark background through."""
    return principled(
        name,
        **{
            "Base Color": (0.93, 0.97, 1.0, 1),
            "Transmission Weight": 0.55,
            "Roughness": 0.02,
            "IOR": 2.42,
            "Specular IOR Level": 1.0,
            "Coat Weight": 1.0,
            "Coat Roughness": 0.0,
        },
    )


def amber_liquid(name="Amber"):
    return principled(
        name,
        **{"Base Color": (0.85, 0.48, 0.12, 1), "Transmission Weight": 1.0, "Roughness": 0.05, "IOR": 1.36},
    )


def bottle_green_glass(name="BottleGlass"):
    return principled(
        name,
        **{"Base Color": (0.05, 0.22, 0.14, 1), "Transmission Weight": 0.85, "Roughness": 0.08, "IOR": 1.5},
    )


def cream_lacquer(name="Cream"):
    return principled(
        name, **{"Base Color": (0.93, 0.87, 0.76, 1), "Roughness": 0.25, "Coat Weight": 0.6, "Coat Roughness": 0.1}
    )


def fur(name="Fur", color=(0.78, 0.55, 0.32, 1)):
    return principled(name, **{"Base Color": color, "Roughness": 0.9, "Sheen Weight": 1.0, "Sheen Roughness": 0.6})


def velvet(name="Velvet", color=(0.12, 0.06, 0.14, 1)):
    return principled(name, **{"Base Color": color, "Roughness": 0.95, "Sheen Weight": 1.0})


def emissive(name="Glow", color=(1.0, 0.8, 0.45, 1), strength=6.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def night_matte(name="NightMatte", color=(0.07, 0.09, 0.2, 1)):
    return principled(name, **{"Base Color": color, "Roughness": 0.8})


# ---- helpers -----------------------------------------------------------------------------------


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def bevel(obj, width=0.02, segments=6):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    return obj


def subsurf(obj, levels=2):
    mod = obj.modifiers.new("Subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return obj


def group(name, objects):
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    for o in objects:
        o.parent = empty
    return empty


def render(root=None):
    """Render one still, or a turntable of FRAMES stills rotating `root` around Z."""
    sc = bpy.context.scene
    if TURNTABLE and root is not None and FRAMES > 1:
        base, ext = OUT.rsplit(".", 1)
        for i in range(FRAMES):
            root.rotation_euler[2] = 2 * math.pi * i / FRAMES
            sc.render.filepath = f"{base}_f{i:02d}.{ext}"
            bpy.ops.render.render(write_still=True)
            print("RENDERED", sc.render.filepath, flush=True)
    else:
        sc.render.filepath = OUT
        bpy.ops.render.render(write_still=True)
        print("RENDERED", OUT, flush=True)
