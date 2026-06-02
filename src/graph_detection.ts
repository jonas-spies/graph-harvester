import {Drawing, Path_Metadata, Stroke} from "./wrappers.js"
import * as utils from "./geometry_utils.js"
import * as mupdf from "mupdf"
import * as fs from "node:fs"

// Only keep vertices with a ratio between that and its inverse
const VERTEX_HEIGHT_WIDTH_RATIO_THRESHOLD = 0.5
// Only consider edges connected to a vertex, if the edge overlaps the vertices bounding box, scaled by this
const VERTEX_EDGE_DISTANCE_THRESHOLD = 1.3


export function detect_graph_from_drawing(drawing : Drawing){
    // Finding Candidates
    let vertex_candidates: Path_Metadata[] = drawing.paths.filter(x => x.type == "fill") //Fill objects can only be vertices and should not be taken apart
    let stroke_paths: Path_Metadata[] = drawing.paths.filter(x => x.type == "stroke") // stroke objects can represent a vertex or one or more edges
    var edge_candidates: Stroke[] = []
    var buffer: string = "Initializing Graph Detection for new Drawing...\n"
    for (var stroke_path of stroke_paths){
        let res = utils.break_path_into_strokes(stroke_path, buffer)
        if (res.is_closed)
            vertex_candidates.push(stroke_path)
        else
            edge_candidates.push(... res.strokes)
    }
    const n = vertex_candidates.length
    //Filter vertices by height / width ratio
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

    buffer += "Found " + vertex_candidates.length +" vertex candidates and " + edge_candidates.length + " edge candidates\n \n"
    let graph = utils.vertices_within_distance_of_edge(VERTEX_EDGE_DISTANCE_THRESHOLD, edge_candidates, vertex_candidates)
    buffer += "GRAPH: \n"
    graph.forEach( (edges: Stroke[], vertex: Path_Metadata) => {
        buffer += ("Vertex: " + vertex.toString() +" with following edges\n")
        for (const edge of edges){
            buffer += ("Edge: " + edge.toString() +"\n")
        }
    } )
    fs.appendFileSync("test_files/log.txt", buffer)
    // TODO handle vertex_candidates
    // TODO handle edge_candidates
    // TODO return detected graph or null
}