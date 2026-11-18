"""Bind a swallow mesh in Blender and export an articulated GLB.

Invoke from Blender background mode with:
  --python rig_swallow.py -- SOURCE OUTPUT.glb [--yaw 0] [--span 3.5]

SOURCE accepts a GLB with spread wings or a lightweight rest-mesh fixture for
checking the pipeline before the production model is available. The GLB path
normalizes forward to +Z and up to +Y for the Wet Paint renderer.
"""

import argparse
import json
from math import cos, radians, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def z_up(p):
    return p[0], -p[2], p[1]


def y_up(p):
    return p[0], p[2], -p[1]


def smoothstep(a, b, value):
    t = min(1, max(0, (value - a) / (b - a)))
    return t*t*(3-2*t)


def load_fixture(path):
    data = json.loads(path.read_text())
    positions, indices = data["positions"], data["indices"]
    points = [z_up(positions[i:i+3]) for i in range(0, len(positions), 3)]
    faces = [indices[i:i+3] for i in range(0, len(indices), 3)]
    mesh = bpy.data.meshes.new("Feather surfaces")
    mesh.from_pydata(points, [], faces)
    uv = mesh.uv_layers.new(name="Paint")
    for loop in mesh.loops:
        i = loop.vertex_index * 2
        uv.data[loop.index].uv = data["uv"][i], 1 - data["uv"][i + 1]
    ink = mesh.attributes.new("_PIGMENT", "FLOAT_COLOR", "POINT")
    color = mesh.color_attributes.new(name="Pigment preview", type="FLOAT_COLOR", domain="POINT")
    palette = ((1, .91, .68), (.16, .75, .88), (1, .29, .17), (.24, .10, .38))
    for i, item in enumerate(ink.data):
        c = data["pigment"][i*4:i*4+4]
        item.color = c
        total = max(sum(c), .001)
        color.data[i].color = tuple(sum(v*p[j] for p, v in zip(palette, c))/total for j in range(3)) + (1.,)
    mesh.color_attributes.active_color = color
    obj = bpy.data.objects.new("Local swallow rig test", mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return [obj], {name: coords for name, coords in data["pivots"]}, data


def load_model(path, yaw, span):
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not objects:
        raise ValueError("The GLB contains no mesh.")
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world.identity()
        obj.data = obj.data.copy()
        obj.data.transform(world)
    points = [y_up(v.co) for ob in objects for v in ob.data.vertices]
    cx, sx = cos(radians(yaw)), sin(radians(yaw))
    points = [(cx*x+sx*z, y, -sx*x+cx*z) for x, y, z in points]
    lo, hi = [tuple(fn(q[i] for q in points) for i in range(3)) for fn in (min, max)]
    scale = span / (hi[0] - lo[0])
    center = ((lo[0]+hi[0])*.5, (lo[1]+hi[1])*.53, (lo[2]+hi[2])*.51)
    source = iter(points)
    for obj in objects:
        for vert in obj.data.vertices:
            vert.co = z_up(tuple((value - mid) * scale for value, mid in zip(next(source), center)))
        obj.data.update()
    pivots = {"Body": (0,0,0)}
    for side, suffix in ((-1, "R"), (1, "L")):
        pivots.update({
            f"Wing.{suffix}": (side*.20,.015,.14),
            f"Tip.{suffix}": (side*.81,.025,-.028),
            f"Tail.{suffix}": (side*.073,-.04,-.49),
        })
    return objects, pivots, None


def bind(objects, pivots, fixture):
    armature = bpy.data.armatures.new("Swallow flight bones")
    rig = bpy.data.objects.new("Swallow_Rig",armature)
    bpy.context.collection.objects.link(rig)
    rig.show_in_front = True
    armature.display_type = "STICK"
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head in sorted(pivots.items(), key=lambda pair: (pair[0] != "Body", pair[0].startswith("Tip"))):
        bone = armature.edit_bones.new(name)
        bone.head = z_up(head)
        bone.tail = (bone.head.x, bone.head.y, bone.head.z+.23)
        bone.align_roll(Vector((0.,1.,0.)))
        if name != "Body":
            parent = "Wing" + name[3:] if name.startswith("Tip") else "Body"
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")

    for mesh in objects:
        mesh.parent = rig
        while mesh.vertex_groups:
            mesh.vertex_groups.remove(mesh.vertex_groups[0])
        groups = {name: mesh.vertex_groups.new(name=name) for name in pivots}
        for vert in mesh.data.vertices:
            x,y,z = y_up(vert.co)
            suffix = "R" if x < 0 else "L"
            side = abs(x)
            if fixture:
                region = fixture["pivots"][fixture["part"][vert.index]][0]
                if region.startswith("Wing"):
                    wing = smoothstep(.17,.34,side)
                    blend = smoothstep(.64,.94,side)*.62
                    weights = {"Body":1-wing,region:wing*(1-blend),"Tip"+region[4:]:wing*blend}
                elif region.startswith("Tip"):
                    tip = smoothstep(.57,.94,side)
                    weights = {"Wing"+region[3:]:1-tip,region:tip}
                else:
                    weights = {region:1.}
            else:
                wing = smoothstep(.17,.42,side)*smoothstep(-.81,-.43,z)
                tail = (1-smoothstep(-.83,-.48,z))*(1-wing)
                tip = smoothstep(.68,.99,side)
                weights = {"Body":1-wing-tail,f"Wing.{suffix}":wing*(1-tip),
                           f"Tip.{suffix}":wing*tip,f"Tail.{suffix}":tail}
            for name,value in weights.items():
                if value > 1e-6:
                    groups[name].add([vert.index],value,"REPLACE")
        modifier = mesh.modifiers.new("Flight deformation", "ARMATURE")
        modifier.object = rig
        modifier.use_deform_preserve_volume = True
    return rig


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--yaw", type=float, default=0.)
    parser.add_argument("--span", type=float, default=3.5)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if args.source.suffix == ".json":
        objects, pivots, fixture = load_fixture(args.source)
    else:
        objects, pivots, fixture = load_model(args.source,args.yaw,args.span)
    rig = bind(objects,pivots,fixture)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in objects or obj is rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(args.output), export_format="GLB", use_selection=True,
        export_animations=False, export_attributes=True,
        export_vertex_color="ACTIVE" if fixture else "MATERIAL",
        export_all_vertex_colors=False,
    )
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.with_suffix(".blend")))
    print("Exported", len(rig.data.bones), "weighted bones,",
          sum(len(o.data.vertices) for o in objects), "mesh vertices.", flush=True)


if __name__ == "__main__":
    main()
