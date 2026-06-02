import { Drawing, Path_Metadata, Stroke } from "./wrappers.js"
import RBush from "rbush"
import KDBush from 'kdbush'
import * as mupdf from "mupdf"


export function merge_bounding_boxes(drawings: Drawing[]){
    const tree = new RBush<Drawing>()
    var result : Drawing[] = []
    var already_used: Map<Drawing, number> = new Map
    tree.load(drawings)
    for (var drawing of drawings){ 
        //For each drawing, check for intersections, only taking drawings not yet used
        let neighbors = tree.search(drawing).filter((x) => !already_used.has(x) && x !== drawing)
        //Get index of cluster drawing belongs to
        var index = already_used.get(drawing)
        if (index === undefined){
            index = result.length
            result.push(drawing)
            already_used.set(drawing, index)
        }
        //Add neighbors to corresponding cluster   
        if (neighbors.length > 0){
            for (var n of neighbors){
                var cluster = result[index]
                if(cluster === undefined)
                    throw new Error("Error: cluster with index"+index+"is out of bounds")
                let merged = Drawing.merge(cluster, n)
                result[index] = merged
                already_used.set(n, index)
            }
        }
    }
    //fs.appendFileSync("test_files/log.txt", "Found "+result.length+" groups: \n"+result.toString() + "\n")
    return result
}


export function transform_point(ctm: mupdf.Matrix, x: number, y: number){
    return {
        x: ctm[0] * x + ctm[2] * y + ctm[4],
        y: ctm[1] * x + ctm[3] * y + ctm[5]
    }
}


export function break_path_into_strokes(stroke_path: Path_Metadata, logs?: string): {strokes: Stroke[], is_closed: boolean} {
           var stroke_segments: Stroke[] = []
        var is_closed = false
        var start: {x: number, y: number} | null
        var loop_start: {x: number, y: number} | null
        var strokeStyle = stroke_path.stroke
        var width: number
        var ctm = stroke_path.ctm
        logs += "\nContinuing with new stroke Path...\n"
        if (strokeStyle === undefined)
            throw new Error("encountered stroke Path with no strokeStyle")
        width = strokeStyle.getLineWidth()
            
        var path_walker = {
            moveTo: function (x: number, y: number) {
                var point = transform_point(ctm, x,y)
                logs += "moving to "+ point.x + " "+ point.y + "\n"
                start = point
                loop_start = point
            },
            lineTo: function (x: number, y: number) {
                if (!start) 
                    throw new Error("lineTo without moveTo")
                var end = transform_point(ctm, x,y)
                logs += "line from "+ start.x+ " "+ start.y + " to "+ end.x + " " + end.y + "\n"
                stroke_segments.push(new Stroke("line", width, [start, end]))
                start = end
            },
            curveTo: function (x1:number, y1:number, x2:number, y2:number, x3:number, y3:number) {
                if (!start) 
                    throw new Error("curveTo without moveTo")
                var p1 = transform_point(ctm, x1, y1)
                var p2 = transform_point(ctm, x2, y2)
                var p3 = transform_point(ctm, x3, y3)
                logs += "curve from " +  start.x + " "+ start.y + " through " + p1.x +" "+ p1.y+" and "+ p2.x +" "+ p2.y + " to "+  p3.x + " "+  p3.y + "\n"
                stroke_segments.push(new Stroke("curve", width, [start, p1, p2, p3]))
                start = p3
            },
            closePath: function () {
                is_closed = true
                if (!loop_start || !start)
                    throw new Error ("closePath without moveTo")
                stroke_segments.push(new Stroke("line", width, [start, loop_start]))
                logs += "closing Path\n"
            }
        } 
        stroke_path.path.walk(path_walker)
        return {strokes: stroke_segments, is_closed: is_closed}
}


export function scale_bb_by_factor(bb: mupdf.Rect, factor: number): mupdf.Rect{
    var width = (bb[2] - bb[0]) * factor
    var height = (bb[3] - bb[1]) * factor
    var center_x = (bb[2] + bb[0]) / 2
    var center_y = (bb[3] + bb[1]) / 2
    var minX = center_x - (width / 2)
    var maxX = center_x + (width / 2)
    var minY = center_y - (height / 2)
    var maxY = center_y + (height / 2)
    return [minX, minY, maxX, maxY] as mupdf.Rect
}


export function vertices_within_distance_of_edge(distance: number, edges: Stroke[], vertices: Path_Metadata[]): Map<Path_Metadata, Stroke[]>{
    const map = new Map<Path_Metadata, Stroke[]>
    const n = edges.length
    const points = [... edges.map(x => x.start), ... edges.map(x => x.end)] // First n indices are of type start, indices from n, ..., 2n-1 are of type end
    const tree = new KDBush(2*n)
    for (const {x,y} of points)
        tree.add(x,y)
    tree.finish()
    for (const v of vertices){
        let bb = scale_bb_by_factor(v.bounds, distance)

        // Make a query for all points within distance of bounding box of v
        const foundIds = tree.range(bb[0], bb[1], bb[2], bb[3])
        const foundEdges = foundIds.map(x => {
            if (x >= n) // Type end
                return edges[x-n]!
            else
                return edges[x]!
        })
        map.set(v, foundEdges)
    }
    return map
}