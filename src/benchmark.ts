import { Graph, Vertex } from "./wrappers.js";
import fs from "fs"
import path from "path"
import { execute_file } from "./pipeline.js";
import mupdf from "mupdf"

const benchmark_directory = "test_files/benchmark/TP"
const result_directory = "test_files/benchmark/V2/"
const matched_flag = "Matched with a graph"
const TP_but_not_A_grade = "test_files/benchmark/TP_but_not_A_grade" // obsolete

function parse_graphs_from_gvs(gv_files: string[], logs? : string[]): Graph[]{
    const graphs : Graph[] = []
    for (const gv_file of gv_files){
        logs?.push("Processing GV: "+gv_file)
        const full_path = path.join(benchmark_directory, gv_file)
        const graph = new Graph()
        graph.metadata.push(gv_file)
        const text = (fs.readFileSync(full_path, "utf8"))
        const lines = text.split(/\r?\n/)

        const vertexRegex = /^\s*v(\d+)\s+\[pos="([^,]+),([^"]+)"\]/
        const edgeRegex = /^\s*v(\d+)\s+--\s+v(\d+)/
        for (const line of lines){
            let vertex = line.match(vertexRegex)
            if (vertex){
                graph.putVertex(new Vertex (Number(vertex[1]), Number(vertex[2]), Number(vertex[3])))
            }
        }
        for (const line of lines){
            let edge = line.match(edgeRegex)
                if (edge){
                    graph.putEdge({v1: Number(edge[1]), v2: Number(edge[2])})
                }
        }
        let subgraphs = graph.split_disconnected_components()
        subgraphs.forEach( (g, index) => {
            logs?.push(g.toString())
            fs.writeFileSync(benchmark_directory+"/modified/"+gv_file+index+".gv", g.toString())
        })
        graphs.push(... subgraphs)
    }
    return graphs
}

// Checks if the two graphs have the same number of edges and vertices
function match_graphs(g1: Graph, g2: Graph): boolean{
    var res: boolean = true
    if(g1.edges.length != g2.edges.length){
        res = false
    }
        
    else if (g1.vertices.length != g2.vertices.length)
        res = false
    if(res){
        g1.metadata.push(matched_flag)
        g2.metadata.push(matched_flag)
    }

    return res
}

// Counts how many graphs could be matched to each other
export function benchmark(){
    var logs: string[] = ["Logs of the most recent benchmark\n"]
    const pdf_files = fs.readdirSync(benchmark_directory).filter(file => file.endsWith(".pdf"))
    const gv_files = fs.readdirSync(benchmark_directory).filter(file => file.endsWith(".gv"))
    var success  = 0
    var total = 0
    var total_ref = 0
    for (const file of pdf_files){
        logs.push("Processing "+ file)
        const full_path = path.join(benchmark_directory, file)
        const file_name = path.parse(file).name
        let graphs = execute_file(fs.readFileSync(full_path), undefined, result_directory+file_name+"_")
        total += graphs.length
        const corresponding_gv_files = gv_files.filter(file => file.startsWith(file_name + "_"))
        const reference_graphs = parse_graphs_from_gvs(corresponding_gv_files)
        total_ref += reference_graphs.length
        for (const ref of reference_graphs){
            for(const graph of graphs){
                if (graph.metadata.some(x => x == matched_flag))
                    continue
                if (match_graphs(ref,graph)){
                    success += 1
                    break
                }          
            }
        }
        for(var i = 0; i<graphs.length; i++){
            let graph = graphs[i]!
            graph.metadata.push(file)
            logs.push(graph.toString())
            exportGraph(graph, result_directory+file_name+"_"+i+".gv")
            exportGraphAsAdjacency(graph, result_directory+file_name+"_"+i+"_adj.txt")
        }
    }
    logs.push("Identified "+success + " out of "+ total_ref + " true positives and found a total of "+total+" graphs.")
    logs.push("Recall: "+ (success / total_ref) + " Precision: "+ (success / total))
    logs.push("False Negatives: "+ (total_ref - success) + " False Positives: "+ (total - success))
    fs.writeFileSync(result_directory+"benchmark.txt", logs.join("\n"))
}


function produceAdjacencyListFromGvs(){
    const gv_files = fs.readdirSync(TP_but_not_A_grade).filter(file => file.endsWith(".gv"))
    const reference_graphs = parse_graphs_from_gvs(gv_files)
    for (const ref of reference_graphs){
        const name = ref.metadata[0]!
        exportGraphAsAdjacency(ref, TP_but_not_A_grade+"/"+path.parse(name).name+ ".txt")
    }
}


function exportGraph(graph: Graph, name: string){
    fs.writeFileSync(name, graph.toString())
}


function exportGraphAsAdjacency(graph: Graph, name: string){
    let adjacency = graph.toAdjacencyMatrix()
    let asString : string = ""
    for (const row of adjacency){
        for (const entry of row){
            asString += (entry + " ")
        }
        asString +="\n"
    }
    fs.writeFileSync(name, asString)
}

benchmark()
//produceAdjacencyListFromGvs()