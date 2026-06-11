import {Drawing, Path_Metadata, Stroke, Graph} from "./wrappers.js"
import * as utils from "./geometry_utils.js"
import * as mupdf from "mupdf"

// Only keep vertices with a ratio between that and its inverse
const VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD = 0.5
// Only consider edges connected to a vertex, if the edge overlaps the vertices bounding box, scaled by this
const VERTEX_EDGE_DISTANCE_THRESHOLD = 1.3


function filter_vertices_by_height_width_ratio(vertex_candidates: Path_Metadata[], edge_candidates: Stroke[]){
    const n = vertex_candidates.length
    for (var i = 0; i < n; i++){
        let vertex = vertex_candidates.shift()
        if (!vertex)
            throw new Error("illegal array length")
        const ratio = vertex.height_width_ratio()
        if ((ratio > VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD && ratio < (1/VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD)))
            vertex_candidates.push(vertex)            
        else if (vertex.type =="stroke")
            edge_candidates.push(... utils.break_path_into_strokes(vertex).strokes)   
    }
}


function filter_vertices_if_incident(vertex_candidates: Path_Metadata[], edge_candidates: Stroke[]){ //TODO: if two vertices are incident, one is likely not a vertex

}


function filter_vertices_by_mean_size(vertex_candidates: Path_Metadata[], edge_candidates: Stroke[]){//TODO: put vertices into clusters by mean size, then only take largest cluster

}


    // Logs for debugging
    /*logs?.push("GRAPH: \n")
    map.forEach( (edges: Stroke[], vertex: Path_Metadata) => {
        logs?.push("Vertex: " + vertex.toString() +" with following edges\n")
        for (const edge of edges){
            logs?.push("Edge: " + edge.toString() +"\n")
        }
    } )*/
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
                do { // Traverse Stroke, until a dead end or a Vertex is found
                    if (!visited.has(current)) // Adds 1 in first iteration, 2 in all other
                        visited.add(current)
                    previous = current.traverse(previous) // previous 0 => 2
                    var aux: Path_Metadata | Stroke | undefined = previous // aux => 2
                    previous = current // previous 2 => 1
                    current = aux // current 1 => 2
                } while(current && (current instanceof Stroke))
                if (current && current !== next){
                    if (!visited.has(current))
                        visited.add(current)
                    graph.putVertex(current)
                    graph.putEdge({v1: graph.getOrPutVertex(next), v2: graph.getOrPutVertex(current)})
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
        if (graph.hasEdges(4) && graph.hasVertices(5))
            graphs.push(graph)
    }
    return graphs
}



function vertices_between_endpoints(edges: Stroke[], vertices: Path_Metadata[]){ // TODO for each vertex, check if it lies between an edges' two endpoints and split those edges in two. 

}


export function detect_graphs_from_drawing(drawing : Drawing, logs? : string[]): Graph[]{
    // Finding Candidates
    let vertex_candidates: Path_Metadata[] = drawing.paths.filter(x => x.type == "fill") //Fill objects can only be vertices and should not be taken apart
    let stroke_paths: Path_Metadata[] = drawing.paths.filter(x => x.type == "stroke") // stroke objects can represent a vertex or one or more edges
    var edge_candidates: Stroke[] = []
    //logs?.push("Initializing Graph Detection for new Drawing...\n")
    for (var stroke_path of stroke_paths){
        let res = utils.break_path_into_strokes(stroke_path)
        if (res.is_closed)
            vertex_candidates.push(stroke_path)
        else
            edge_candidates.push(... res.strokes)
    }
    filter_vertices_by_height_width_ratio(vertex_candidates, edge_candidates)
    //logs?.push("Found " + vertex_candidates.length +" vertex candidates and " + edge_candidates.length + " edge candidates\n \n")
    // TODO filter overlapping vertices, filter vertices based on size(?)
    let graph = utils.vertices_within_distance_of_edge(VERTEX_EDGE_DISTANCE_THRESHOLD, edge_candidates, vertex_candidates)
    //vertices_between_endpoints()
    let areas: number[] = []
    vertex_candidates.forEach(x => areas.push(x.area()))
    let radius = Math.sqrt(utils.median(areas)) / 2 // not exact but good enough
    utils.edges_incident_to_edges(radius*VERTEX_EDGE_DISTANCE_THRESHOLD, edge_candidates, graph)
    const graphs = build_graphs_from_map(graph, logs)
    for (const graph of graphs){
        logs?.push(graph.toString())
    }
    return graphs
    // TODO handle vertex_candidates
    // TODO handle edge_candidates
}