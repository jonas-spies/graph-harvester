import { Drawing, Path_Metadata, Stroke } from "./wrappers.js"
import RBush from "rbush"
import KDBush from 'kdbush'
import * as mupdf from "mupdf"

// Approximate every bezier curve by 20 straight line segments
const STROKE_APPROXIMATION_RESOLUTION = 20


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
    return result
}

// For t=0, returns start point, for t=1 returns end point. For anything inbetween, it returns the respective point on the line
export function walk_along_edge(edge: Stroke, t: number): {x: number, y: number} {
    if (t > 1 || t < 0)
        throw new Error("Illegal argument for t")
    if (edge.type == "line"){
        let x = edge.start.x * t + edge.end.x * (1-t)
        let y = edge.start.y * t + edge.end.y * (1-t)
        return {x,y}
    }
    let p0: {x: number, y: number} = edge.start
    let p1: {x: number, y: number} = edge.control_pts![0]!
    let p2: {x: number, y: number} = edge.control_pts![1]!
    let p3: {x: number, y: number} = edge.end
    let u = 1 - t
    return {
        x:
            u*u*u*p0.x +
            3*u*u*t*p1.x +
            3*u*t*t*p2.x +
            t*t*t*p3.x,

        y:
            u*u*u*p0.y +
            3*u*u*t*p1.y +
            3*u*t*t*p2.y +
            t*t*t*p3.y
    }
}


export function transform_point(ctm: mupdf.Matrix, x: number, y: number){
    return {
        x: ctm[0] * x + ctm[2] * y + ctm[4],
        y: ctm[1] * x + ctm[3] * y + ctm[5]
    }
}


export function break_path_into_strokes(stroke_path: Path_Metadata, logs?: string[]): {strokes: Stroke[], is_closed: boolean} {
        var stroke_segments: Stroke[] = []
        var is_closed = false
        var start: {x: number, y: number} | null
        var loop_start: {x: number, y: number} | null
        var strokeStyle = stroke_path.stroke
        var ctm = stroke_path.ctm
        logs?.push("\nContinuing with new stroke Path...\n")
        if (strokeStyle === undefined)
            throw new Error("encountered stroke Path with no strokeStyle")
            
        var path_walker = {
            moveTo: function (x: number, y: number) {
                var point = transform_point(ctm, x,y)
                logs?.push("moving to "+ point.x + " "+ point.y + "\n")
                start = point
                loop_start = point
            },
            lineTo: function (x: number, y: number) {
                if (!start) 
                    throw new Error("lineTo without moveTo")
                var end = transform_point(ctm, x,y)
                logs?.push("line from "+ start.x+ " "+ start.y + " to "+ end.x + " " + end.y + "\n")
                stroke_segments.push(new Stroke("line", strokeStyle!, [start, end]))
                start = end
            },
            curveTo: function (x1:number, y1:number, x2:number, y2:number, x3:number, y3:number) {
                if (!start) 
                    throw new Error("curveTo without moveTo")
                var p1 = transform_point(ctm, x1, y1)
                var p2 = transform_point(ctm, x2, y2)
                var p3 = transform_point(ctm, x3, y3)
                logs?.push("curve from " +  start.x + " "+ start.y + " through " + p1.x +" "+ p1.y+" and "+ p2.x +" "+ p2.y + " to "+  p3.x + " "+  p3.y + "\n")
                stroke_segments.push(new Stroke("curve", strokeStyle!, [start, p1, p2, p3]))
                start = p3
            },
            closePath: function () {
                is_closed = true
                if (!loop_start || !start)
                    throw new Error ("closePath without moveTo")
                stroke_segments.push(new Stroke("line", strokeStyle!, [start, loop_start]))
                logs?.push("closing Path\n")
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

// OLD VERSION
/*export function vertices_within_distance_of_edge(distance: number, edges: Stroke[], vertices: Path_Metadata[]): Map<Path_Metadata, Stroke[]>{
    const map = new Map<Path_Metadata, Stroke[]>()
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
            if (x >= n){ // Type end
                let edge = edges[x-n]!
                edge.end_incident = v
                return edge
            }         
            else {  //Type Start
                let edge = edges[x]!
                edge.start_incident = v
                return edge
                
            }
        })
        map.set(v, foundEdges)
    }
    return map
}*/
// NEW VERSION
export function vertices_within_distance_of_edge(distance: number, edges: Stroke[], vertices: Path_Metadata[]): Map<Path_Metadata, Stroke[]>{
    const map = new Map<Path_Metadata, Stroke[]>()
    const point_to_edge: Stroke[] = [] // using this, index of point leads to corresponding edge
    const edge_to_index_range = new Map<Stroke, {first_index : number, last_index: number}>()
    const points: {x: number, y: number}[] = []
    var index = 0
    for (const edge of edges){
        let edge_points = edge.toPolyLine(STROKE_APPROXIMATION_RESOLUTION)
        edge_to_index_range.set(edge, {first_index: index, last_index: (index + edge_points.length -1)})
        for (const point of edge_points){
            points.push(point)
            point_to_edge.push(edge)
            index++
        }
    }
    const n = points.length
    const tree = new KDBush(n)
    for (const {x,y} of points)
        tree.add(x,y)
    tree.finish()
    for (const v of vertices){ // O(n)
        let bb = scale_bb_by_factor(v.bounds, distance)
        // Make a query for all points within distance of bounding box of v
        const foundIds = tree.range(bb[0], bb[1], bb[2], bb[3])
        const foundEdges: Set<Stroke> = new Set()
        foundIds.forEach(x => {
            let edge = point_to_edge[x]!
            foundEdges.add(edge)
        })
        const incident_edges : Stroke[] = []
        const x = v.center().x
        const y = v.center().y
        for (const edge of foundEdges){ // O(m)
            let {first_index, last_index} = edge_to_index_range.get(edge)!
            var lowest_distance = Infinity
            var lowest_index = first_index
            for (var i = first_index; i <= last_index; i++){ // O(1) => total runtime quadratic
                let {x: px, y: py} = points[i]!
                const distance = ((px - x) * (px - x)) + ((py - y) * (py - y)) // euclidean distance without sqrt
                if (distance < lowest_distance){
                    lowest_distance = distance
                    lowest_index = i
                }
            }
            switch(lowest_index){
                case first_index:
                    edge.start_incident = v
                    incident_edges.push(edge)
                    break
                case last_index:
                    edge.end_incident = v
                    incident_edges.push(edge)
                    break
                default: // TODO: only the vertices will know of the edges, not vice versa. Write a function that splits edges along unknown vertices
                    incident_edges.push(edge)
                    break
            }
        }
        map.set(v, incident_edges)
    }
    return map
}

function add_to_graph_map(graph: Map<Path_Metadata, Stroke[]>, vertex: Path_Metadata, edge: Stroke){
    let list = graph.get(vertex)
    if (!list){
        list = []
        graph.set(vertex, list)
    }
    list.push(edge)
}


export function split_edges_with_middle_vertex(graph: Map<Path_Metadata, Stroke[]>): Map<Path_Metadata, Stroke[]> {
    const edge_to_vertices = new Map<Stroke, Path_Metadata[]>()
    const new_graph = new Map<Path_Metadata, Stroke[]>()
    for (const [vertex, edges] of graph){
        for (const edge of edges){
            let list = edge_to_vertices.get(edge)
            if (!list){
                list = []
                edge_to_vertices.set(edge, list)
            }
            list.push(vertex)
        }
    }
    for (const [edge, vertices] of edge_to_vertices){
        const edge_points = edge.toPolyLine(STROKE_APPROXIMATION_RESOLUTION)
        const split_points: {vertex: Path_Metadata, t: number}[] = []
        const start_vertices = new Set<Path_Metadata>()
        const end_vertices = new Set<Path_Metadata>()

        for (const vertex of vertices){
            const {x, y} = vertex.center()
            var shortest_distance = Infinity
            var shortest_index = 0
            for (var i = 0; i < edge_points.length; i++){
                let {x: px, y: py} = edge_points[i]!
                const distance = ((px - x) * (px - x)) + ((py - y) * (py - y)) // euclidean distance without sqrt
                if (distance < shortest_distance){
                    shortest_distance = distance
                    shortest_index = i
                }
            }
            switch(shortest_index){
                case 0:
                    start_vertices.add(vertex)
                    break
                case edge_points.length -1:
                    end_vertices.add(vertex)
                    break
                default:
                    const t = shortest_index / (edge_points.length-1)
                    split_points.push({vertex, t})
            }
        }
        if (split_points.length == 0){
            for (const vertex of vertices){
                add_to_graph_map(new_graph, vertex, edge)
            }
            continue
        }
        split_points.sort( (a,b) => a.t - b.t)
        const breakpoints = [{t: 0, vertex: [...start_vertices][0] ?? undefined}, ...split_points, {t: 1, vertex: [...end_vertices][0] ?? undefined}]
        for (var i = 0; i < breakpoints.length-1; i++){
            const left = breakpoints[i]!
            const right = breakpoints[i+1]!

            const p1 = walk_along_edge(edge, left.t)
            const p2 = walk_along_edge(edge, right.t)

            const segment = new Stroke("line", edge.stroke, [p1,p2])
            if (left.vertex){
                segment.start_incident = left.vertex
                add_to_graph_map(new_graph, left.vertex, segment)
            }
            if (right.vertex){
                segment.end_incident = right.vertex
                add_to_graph_map(new_graph, right.vertex, segment)
            }
        }
    }
    return new_graph
}


function stroke_similarity(a: mupdf.StrokeState, b: mupdf.StrokeState){ //TODO compares two StrokeStyles and gives a similarity score in the end
    return (
        a.getLineWidth === b.getLineWidth &&
        a.getLineCap === b.getLineCap &&
        a.getLineJoin === b.getLineJoin
    )
}


export function median(values: number[]): number {
    if (values.length === 0)
        throw new Error("Cannot compute median of empty array")
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted[mid]!
}

// Ideally used on the set of all orphans and half orphans when some vertices have already been identified. From there, taking the median radius of vertices times a multiplier gives a decent distance threshold
export function edges_incident_to_edges(distance: number, edges: Stroke[], graph: Map<Path_Metadata, Stroke[]>){ // TODO? filter based on StrokeStyle for the most likely candidate
    const n = edges.length
    const points = [... edges.map(x => x.start), ... edges.map(x => x.end)] // First n indices are of type start, indices from n, ..., 2n-1 are of type end
    const tree = new KDBush(2*n)
    for (const {x,y} of points)
        tree.add(x,y)
    tree.finish()
    for (var i = 0; i < 2*n; i++){
        var edge : Stroke
        var point : {x: number, y: number}
        const start = (i < n) // indicates if i is index of start point
        if (start){
            edge = edges[i]!
            point = edge.start
        }
        else{
            edge = edges[i - n]!
            point = edge.end
        }
        if ( (start && edge.start_incident) || (!start && edge.end_incident))
            continue            
        const indices = tree.within(point.x, point.y, distance).filter(x => (x != i) && (x != i + n) && (x != i - n)) // don't include points from the same edge
        switch(indices.length){
            case 0: // edge stays an orphan
                break
            case 1: // edge is continued
                let index = indices[0]!
                const other_edge = index < n? (edges[index]!) : (edges[index - n]!)
                //TODO: maybe infer a vertex if StrokeStyle differs too much
                if (start)
                    edge.start_incident = other_edge
                else
                    edge.end_incident = other_edge
                break
            default: // more than 1 indicates an implied vertex
                let vertex = new Path_Metadata(new mupdf.Path(), [point.x - (distance/2), point.y -(distance/2), point.x + (distance/2), point.y + (distance/2)], mupdf.Matrix.identity, "fill")
                let edgelist: Stroke[] = [edge]
                for (const index of indices) {
                    const other_edge = index < n? (edges[index]!) : (edges[index - n]!)
                    if (index < n)
                        other_edge.start_incident = vertex
                    else
                        other_edge.end_incident = vertex
                    edgelist.push(other_edge)
                }
                graph.set(vertex, edgelist)
                if (start)
                    edge.start_incident = vertex
                else
                    edge.end_incident = vertex
        }
    }
}