import { Drawing, Path_Metadata, Stroke } from "./wrappers.js"
import RBush from "rbush"
import KDBush from 'kdbush'
import * as mupdf from "mupdf"

// Approximate every bezier curve by 30 straight line segments
const STROKE_APPROXIMATION_RESOLUTION = 30

/**Merges drawings by overlapping bounding boxes
 * @returns a list of Drawings, so that each element exclusively contains the Path objects of one or more original Drawing.*/
export function merge_bounding_boxes(drawings: Drawing[]): Drawing[]{
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


/**Applies a matrix transformation on the point, returning its new coordinates*/
export function transform_point(ctm: mupdf.Matrix, x: number, y: number): {x: number, y: number}{
    return {
        x: ctm[0] * x + ctm[2] * y + ctm[4],
        y: ctm[1] * x + ctm[3] * y + ctm[5]
    }
}


/** Takes a path object and returns a list of all its strokes, as well as a boolean indicating if the path formed a closed loop
@warning if there is even just a fraction of a pixel between the start and endpoint, it won't be considered a closed loop*/
export function break_path_into_strokes(stroke_path: Path_Metadata, logs?: string[]): {strokes: Stroke[], is_closed: boolean} {
        var stroke_segments: Stroke[] = []
        var is_closed = false
        var last: {x: number, y: number} | undefined
        var loop_start: {x: number, y: number} | undefined
        var strokeStyle = stroke_path.stroke
        var ctm = stroke_path.ctm
        logs?.push("\nContinuing with new stroke Path...\n")
        if (strokeStyle === undefined)
            throw new Error("encountered stroke Path with no strokeStyle")
            
        var path_walker = {
            moveTo: function (x: number, y: number) {
                var point = transform_point(ctm, x,y)
                logs?.push("moving to "+ point.x + " "+ point.y + "\n")
                last = point
                loop_start = point
            },
            lineTo: function (x: number, y: number) {
                if (!last) 
                    throw new Error("lineTo without moveTo")
                var end = transform_point(ctm, x,y)
                logs?.push("line from "+ last.x+ " "+ last.y + " to "+ end.x + " " + end.y + "\n")
                stroke_segments.push(new Stroke("line", strokeStyle!, [last, end]))
                last = end
            },
            curveTo: function (x1:number, y1:number, x2:number, y2:number, x3:number, y3:number) {
                if (!last) 
                    throw new Error("curveTo without moveTo")
                var p1 = transform_point(ctm, x1, y1)
                var p2 = transform_point(ctm, x2, y2)
                var p3 = transform_point(ctm, x3, y3)
                logs?.push("curve from " +  last.x + " "+ last.y + " through " + p1.x +" "+ p1.y+" and "+ p2.x +" "+ p2.y + " to "+  p3.x + " "+  p3.y + "\n")
                stroke_segments.push(new Stroke("curve", strokeStyle!, [last, p1, p2, p3]))
                last = p3
            },
            closePath: function () {
                is_closed = true
                if (!loop_start || !last)
                    throw new Error ("closePath without moveTo")
                stroke_segments.push(new Stroke("line", strokeStyle!, [last, loop_start]))
                logs?.push("closing Path\n")
            }
        } 
        stroke_path.path.walk(path_walker)
        if (loop_start && last && loop_start.x == last.x && loop_start.y == last.y)
            is_closed = true
        return {strokes: stroke_segments, is_closed: is_closed}
}


/**Takes a bounding box array [xmin, ymin, xmax, ymax] and expands it by the factor into every direction, originating from the center */
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
/**Breaks up each edge into a constant number of sample points, then checks for each vertex what sample points lie within range of its bounding box.
 * @constant STROKE_APPROXIMATION_RESOLUTION specifies how many sample points will be made for each edge
 * @input distance: a factor by which a vertex's bounding box is scaled before checking if any sample points lie in that box
 * @input edges: each edge is modified so that its .start or .end are linked to up to one vertex incident to its respective endpoint
 * @output A map that returns for each vertex a list of incident edges. This is the only way in which the relation between vertices lying between two endpoints of an edge is stored 
 * @warning If multiple vertices are incident to the same edge endpoint, an arbitrary one will be linked to it, but the others will still be featured in the output map*/
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


/**Auxiliary function which adds an edge to the list of incident edges of a given vertex, while ensuring the vertex and its list are registered in the map*/
function add_to_graph_map(graph: Map<Path_Metadata, Stroke[]>, vertex: Path_Metadata, edge: Stroke){
    let list = graph.get(vertex)
    if (!list){
        list = []
        graph.set(vertex, list)
    }
    list.push(edge)
}


/**Determines for each edge how many vertices lie between its two endpoints, approximates its coordinates on the line using STROKE_APPROXIMATION_RESOLUTION, and splits each edge along these points.
 * Then returns a new map and edge list based on the new edges, without modifying the input objects.
 * @warning the new map currently throws away isolated vertices and full orphans
 * @TODO make it so rescued full orphans at least make it into the new_edges list */
export function split_edges_with_middle_vertex(graph: Map<Path_Metadata, Stroke[]>, edges: Stroke[], logs? : string[]): {new_graph: Map<Path_Metadata, Stroke[]>, new_edges: Stroke[]} {
    if(logs){
        logs?.push("Splitting edges with middle vertex...\n")
        for (const edge of edges){
            logs?.push("Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " BEFORE [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")
        }
    }
    const edge_to_vertices = new Map<Stroke, Path_Metadata[]>()
    const new_graph = new Map<Path_Metadata, Stroke[]>()
    const new_edges : Stroke[] = []
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
        var start_vertex = edge.start_incident
        var end_vertex = edge.end_incident

        for (const vertex of vertices){ // determine for all vertices on the edge which point is closest, ensuring no more than one vertex per endpoint
            const {x, y} = vertex.center()
            var shortest_distance = Infinity
            var shortest_index = 0
            if (start_vertex === vertex || end_vertex === vertex)
                continue
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
                    if (!start_vertex)
                        start_vertex = vertex
                    else if(start_vertex){
                        const t = 1 / (edge_points.length-1)
                        split_points.push({vertex, t})
                    }
                    break
                case edge_points.length -1:
                    if (!end_vertex)
                        end_vertex = vertex
                    else if (end_vertex){
                        const t = (edge_points.length -2) / (edge_points.length-1)
                        split_points.push({vertex, t})                        
                    }
                    break
                default:
                    const t = shortest_index / (edge_points.length-1)
                    split_points.push({vertex, t})
            }
        }
        if (split_points.length == 0){ // keep edge, if there are no middle points
            new_edges.push(edge)
            for (const vertex of vertices){
                add_to_graph_map(new_graph, vertex, edge)
            }
            continue
        }
        split_points.sort( (a,b) => a.t - b.t)
        const breakpoints = [{t: 0, vertex: start_vertex}, ...split_points, {t: 1, vertex: end_vertex}]
        logs?.push("Next edge: "+ edge.start.x + ", "+ edge.start.y + " | " + edge.end.x + ", " + edge.end.y +"\n")
        for (const breakpt of breakpoints){
            const vertex = breakpt.vertex? breakpt.vertex.toString() : "undefined"
            logs?.push("t: " + breakpt.t + " Endpt: " + vertex +"\n")
        }
        for (var i = 0; i < breakpoints.length-1; i++){
            const left = breakpoints[i]!
            const right = breakpoints[i+1]!

            const p1 = edge.walk_along_edge(left.t)
            const p2 = edge.walk_along_edge(right.t)

            const segment = new Stroke("line", edge.stroke, [p1,p2])
            new_edges.push(segment)
            if (left.vertex instanceof Path_Metadata){
                segment.start_incident = left.vertex
                add_to_graph_map(new_graph, left.vertex, segment)
            }
            if (right.vertex instanceof Path_Metadata){
                segment.end_incident = right.vertex
                add_to_graph_map(new_graph, right.vertex, segment)
            }
        }
    }
    if(logs){
        for (const edge of new_edges){
            logs?.push("Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " AFTER [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")
        }
    }    
    //WARNING: isolated vertices will simply be discarded here
    return {new_graph, new_edges}
}


/**Currently returns true if two StrokeState objects are equivalent, else false */
function stroke_similarity(a: mupdf.StrokeState, b: mupdf.StrokeState){ //TODO compares two StrokeStyles and gives a similarity score in the end
    return (
        a.getLineWidth === b.getLineWidth &&
        a.getLineCap === b.getLineCap &&
        a.getLineJoin === b.getLineJoin
    )
}


/** Returns the median of a list of numbers */
export function median(values: number[]): number {
    if (values.length === 0)
        throw new Error("Cannot compute median of empty array")
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted[mid]!
}


/** Checks for each edge if it is an orphan or half orphan, then checks if any endpoints of another edge lie within range.
 * If exactly one edge is incident, this will become its neighbor. If two or more edges are incident, this will be interpreted as an implied vertex.
 * @input distance: distance in pixels that two endpoints can be apart to still be considered incident to each other. Currently chosen as the median radius of all vertex candidates. 
 * @TODO bugfixes: does not rescue all orphans currently */
export function edges_incident_to_edges(distance: number, edges: Stroke[], graph: Map<Path_Metadata, Stroke[]>, logs? : string[]){ // TODO? filter based on StrokeStyle for the most likely candidate
    const n = edges.length
    const points = [... edges.map(x => x.start), ... edges.map(x => x.end)] // First n indices are of type start, indices from n, ..., 2n-1 are of type end
    const tree = new KDBush(2*n)
    if(logs){
        logs?.push("Rescuing orphans...\n")
        for (const edge of edges){
            logs?.push("Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " BEFORE [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")
        }
    }
    for (const {x,y} of points)
        tree.add(x,y)
    tree.finish()
    for (var i = 0; i < 2*n; i++){ // for each endpoint of an edge do...
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
        else
            logs?.push("Trying to rescue an orphan at point "+ point.x + ", "+point.y +" for Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")          
        var indices = tree.within(point.x, point.y, distance)
        logs?.push("Found "+indices.length + " initial hits \n")
        for (const index of indices){
            let edge = edges[index < n? index : index -n]!
            logs?.push("Hit: Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")
        }
        indices = indices.filter( (value, key) => { // FILTER: 1) endpoints that are not orphaned. 2) endpoints that are incident to their other end.
            if (value == i || value == i + n || value == i - n) // Self hit
                return false
            logs?.push("Value: "+value + " OG Edge: "+i + " n: "+n +"\n")
            for (var j = 0; j < indices.length; j++){
                if (j == key)
                    continue
                let other = indices[j]!
                if (value == other || value == other + n || value == other - n){ // Two endpoints of the same edge detected
                    return false
                }      
            }
            return true
        })
        logs?.push("After filtering, "+indices.length + " hits remain\n")
        /*console.log("Start Point: "+ point.x + ", "+ point.y)
        for (const index of indices){
            let next_point = points[index]!
            console.log("Incident point: "+next_point.x + ", "+ next_point.y)
        }*/
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
                logs?.push("Found implied vertex: x ="+ point.x + "y ="+point.y+"\n")
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
    if (logs){
        for (const edge of edges){
            logs?.push("Edge "+ edge.start.x + ", "+edge.start.y + " | "+ edge.end.x + ", "+ edge.end.y + " AFTER [Start, End]: "+ (edge.start_incident? "true" : "false") + (edge.end_incident? " true" : " false") +"\n")
        }
    }
}