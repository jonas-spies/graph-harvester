import {Drawing, Path_Metadata, Stroke} from "./wrappers.js"
import * as utils from "./geometry_utils.js"
import * as mupdf from "mupdf"
import * as fs from "node:fs"



export function detect_graph_from_drawing(drawing : Drawing){
    // Finding Candidates
    let vertex_candidates: Path_Metadata[] = drawing.paths.filter(x => x.type == "fill") //Fill objects can only be vertices and should not be taken apart
    let stroke_paths: Path_Metadata[] = drawing.paths.filter(x => x.type == "stroke") // stroke objects can represent a vertex or one or more edges
    var edge_candidates: Stroke[] = []
    var buffer: string = "Initializing Graph Detection for new Drawing...\n"
    for (var stroke_path of stroke_paths){
        var stroke_segments: Stroke[] = []
        var is_closed = false
        var start: {x: number, y: number} | null
        var strokeStyle = stroke_path.stroke
        var width: number
        var ctm = stroke_path.ctm
        buffer += "\nContinuing with new stroke Path...\n"
        if (strokeStyle === undefined)
            throw new Error("encountered stroke Path with no strokeStyle")
        width = strokeStyle.getLineWidth()
            
        var path_walker = {
            moveTo: function (x: number, y: number) {
                var point = utils.transform_point(ctm, x,y)
                buffer += "moving to "+ point.x + " "+ point.y + "\n"
                start = point
            },
            lineTo: function (x: number, y: number) {
                if (!start) 
                    throw new Error("lineTo without moveTo")
                var end = utils.transform_point(ctm, x,y)
                buffer += "line from "+ start.x+ " "+ start.y + " to "+ end.x + " " + end.y + "\n"
                stroke_segments.push(new Stroke("line", width, [start, end]))
                start = end
            },
            curveTo: function (x1:number, y1:number, x2:number, y2:number, x3:number, y3:number) {
                if (!start) 
                    throw new Error("curveTo without moveTo")
                var p1 = utils.transform_point(ctm, x1, y1)
                var p2 = utils.transform_point(ctm, x2, y2)
                var p3 = utils.transform_point(ctm, x3, y3)
                buffer += "curve from " +  start.x + " "+ start.y + " through " + p1.x +" "+ p1.y+" and "+ p2.x +" "+ p2.y + " to "+  p3.x + " "+  p3.y + "\n"
                stroke_segments.push(new Stroke("curve", width, [start, p1, p2, p3]))
                start = p3
            },
            closePath: function () {
                is_closed = true
                buffer += "closing Path\n"
            }
        }   
        
        stroke_path.path.walk(path_walker)
        if (is_closed)
            vertex_candidates.push(stroke_path)
        else
            edge_candidates.push(... stroke_segments)
    }
    buffer += "Found " + vertex_candidates.length +" vertex candidates and " + edge_candidates.length + " edge candidates\n \n"
    fs.appendFileSync("test_files/log.txt", buffer)
    // TODO handle vertex_candidates
    // TODO handle edge_candidates
    // TODO return detected graph or null
}