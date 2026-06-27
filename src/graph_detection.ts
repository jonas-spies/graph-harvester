import {Drawing, Path_Metadata, Stroke, Graph} from "./wrappers.js"
import * as utils from "./geometry_utils.js"

// Only keep vertices with a ratio between that and its inverse
const VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD = 0.5
// Only consider edges connected to a vertex, if the edge overlaps the vertices bounding box, scaled by this
const VERTEX_EDGE_DISTANCE_THRESHOLD = 1.3
// Filter vertices that take up 25% or more of the drawing's bounding box
const DRAWING_AREA_THRESHOLD = 0.2


/** Uses various checks to turn all vertex candidates that fail one of them into edge candidates
 * @CHECK Vertices must be somewhat shaped like a square (height / width ratio)
 * @CHECK Vertices must be somewhat small compared to the overall drawings
 */
function filter_vertices(vertex_candidates: Path_Metadata[], edge_candidates: Stroke[], params: {height_width: boolean, drawing_area:number}){
    const n = vertex_candidates.length
    for (var i = 0; i < n; i++){
        let vertex = vertex_candidates.shift()
        var is_good = true
        if (!vertex)
            throw new Error("illegal array length")
        // Filter vertices that are not "square-like" enough
        if(params.height_width){
            const ratio = vertex.height_width_ratio()
            if (!(ratio > VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD && ratio < (1/VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD)))
                is_good = false
        }
        // Filter Large Vertices
        if(params.drawing_area != 0  && vertex.area() >= params.drawing_area * DRAWING_AREA_THRESHOLD){
            is_good = false
        }
        // Filter overlapping vertices


        // Code that actually does something with the flag
        if (is_good)
            vertex_candidates.push(vertex)            
        else if (vertex.type =="stroke")
            edge_candidates.push(... utils.break_path_into_strokes(vertex).strokes)   
    }
}


/** */
function filter_vertices_by_mean_size(vertex_candidates: Path_Metadata[], edge_candidates: Stroke[]){//TODO: put vertices into clusters by mean size, then only take largest cluster

}


/** Given a map that links each vertex to a list of incident edges, where each edge has a pointer to whatever its start or endpoint is icndient to, performs DFS to find each connected component and turn it into a graph.
 * Rejects graphs with less than 5 vertices and less than 4 edges*/
function build_graphs_from_map(map: Map<Path_Metadata, Stroke[]>, logs?: string[]): Graph[]{
    const visited : Set<Path_Metadata | Stroke> = new Set<Path_Metadata | Stroke>()
    const graphs : Graph[] = []
    for (const vertex of map.keys()){ // for every vertex, do DFS
        if (visited.has(vertex)) // already part of some graph, so skip
            continue
        const graph = new Graph()
        const vertices: Path_Metadata[] = [vertex]
        while (vertices.length > 0){ // actual DFS
            let next = vertices.pop()!
            if(!visited.has(next)){ //Adds element 0 (imagine an edge called 1 with two endpoints 0,2 in a chain 0 - 1 - 2)
                visited.add(next)
                graph.putVertex(next)
            }
            let edge = map.get(next)!.find((edge) => !visited.has(edge)) //An arbitrary edge that has not yet been visited
            if (edge){
                var previous: Path_Metadata | Stroke | undefined = next // 0
                var current: Path_Metadata | Stroke | undefined = edge // 1
                let path : Stroke[] = []
                do { // Traverse Stroke, until a dead end or a Vertex is found
                    if (!visited.has(current)) // Adds 1 in first iteration, 2 in all other
                        visited.add(current)
                    path.push(current)
                    previous = current.traverse(previous) // previous 0 => 2
                    var aux: Path_Metadata | Stroke | undefined = previous // aux => 2
                    previous = current // previous 2 => 1
                    current = aux // current 1 => 2
                } while(current && (current instanceof Stroke))
                if (current && current !== next){
                    if (!visited.has(current))
                        visited.add(current)
                    graph.putVertex(current)
                    graph.putEdge({v1_id: graph.getOrPutVertex(next), v2_id: graph.getOrPutVertex(current), path})
                    vertices.push(next)
                    vertices.push(current)
                }
                else{ // Edge candidate wasnt an edge after all
                    vertices.push(next)
                }
            }
            else { // Vertex has no unseen edges
                continue
            }
        }
        if (graph.hasEdges(Graph.MINIMUM_EDGES) && graph.hasVertices(Graph.MINIMUM_VERTICES))
            graphs.push(graph)
    }
    return graphs
}


// Probably too dangerous because it produces many very short segments that might all be incident to one vertex
/*function approximate_curves_as_straight_line_segments(edges: Stroke[]){
    let n = edges.length
    for (var i = 0; i < n; i++){
        let edge = edges.shift()!
        if (edge.type == "line"){ // Already straight line
            edges.push(edge)
            continue
        }
        let increment = 1 / BEZIER_APPROXIMATION_RESOLUTION
        let last = edge.start
        var t = increment
        while (t < (1 - increment)){ // ensures that the last segment is at least increment long
            let point = utils.walk_along_edge(edge, t)
            edges.push(new Stroke("line", edge.stroke, [last, point]))
            last = point
            t += increment
        }
        edges.push(new Stroke("line", edge.stroke, [last, edge.end]))
    }
}*/


/**The access point to graph detection. Takes a drawing and tries to extract a list of graphs from it. */
export function detect_graphs_from_drawing(drawing : Drawing, logs? : string[]): Graph[]{
    // Finding Candidates
    let vertex_candidates: Path_Metadata[] = drawing.paths.filter(x => x.type == "fill") //Fill objects can only be vertices and should not be taken apart
    let stroke_paths: Path_Metadata[] = drawing.paths.filter(x => x.type == "stroke") // stroke objects can represent a vertex or one or more edges
    var edge_candidates: Stroke[] = []
    //logs?.push("Initializing Graph Detection for new Drawing...\n")
    for (var stroke_path of stroke_paths){
        let res = utils.break_path_into_strokes(stroke_path)
        if (res.is_closed){
            stroke_path.shape = res.shape
            vertex_candidates.push(stroke_path)
        }
            
        else
            edge_candidates.push(... res.strokes) //TODO: stroke circles land here!
    }
    filter_vertices(vertex_candidates, edge_candidates,{height_width: true, drawing_area: drawing.area()})
    // TODO filter overlapping vertices, filter vertices based on size(?)
    if (vertex_candidates.length == 0 || edge_candidates.length == 0){
        //console.log("Found an empty drawing. Vertices: " + vertex_candidates.length + " Edges: "+ edge_candidates.length)
        return []
    }
    utils.merge_overlapping_vertices(vertex_candidates)
    //console.log("inititial vertex candidates: "+vertex_candidates.length + " edge candidates: "+edge_candidates.length)
    let graph = utils.vertices_within_distance_of_edge(VERTEX_EDGE_DISTANCE_THRESHOLD, edge_candidates, vertex_candidates)
    // Start of new V2 features
    utils.edges_incident_to_edges(edge_candidates, graph)
    let {new_graph, new_edges} = utils.split_edges_with_middle_vertex(graph, edge_candidates)
    graph = new_graph
    edge_candidates = new_edges
    //console.log("filtered number of edge candidates: "+edge_candidates.length)
    // End V2
    const graphs = build_graphs_from_map(graph)
    if (logs)
        for (const graph of graphs){
            logs.push(graph.toString())
            logs.push("G6: "+graph.toGraph6())
            let adj = graph.toAdjacencyMatrix()
            logs.push("Adjacency:")
            for (const row of adj)
                logs.push(row.toString())
        }
    return graphs
}