import * as mupdf from 'mupdf'


class Vertex{
    x_pos: number
    y_pos: number
    id: number
    constructor(id: number, x: number, y: number){
        this.id = id
        this.x_pos = x 
        this.y_pos = y
    }
}


export class Graph{
    edges: {v1: number, v2: number}[]
    private map: Map<Path_Metadata, number>
    vertices: Vertex[]
    private smallest_free_id: number
    private used_ids: Set<number>
    metadata: string[]


    constructor(vertices?: Path_Metadata[], edges?: {v1: Path_Metadata, v2: Path_Metadata}[]){
        this.map = new Map()
        this.used_ids = new Set()
        this.edges = []
        this.vertices = []
        this.metadata = []
        var index = 1
        if (vertices){
            for (const v of vertices){
                this.used_ids.add(index)
                this.map.set(v, index)
                this.vertices.push(new Vertex(index++, v.center().x, v.center().y))
            }
        }
        this.smallest_free_id = index
        if(edges){
            for (const edge of edges){
                let v1 = this.map.get(edge.v1)
                let v2 = this.map.get(edge.v2)
                if (!v1)
                    v1 =this.putVertex(edge.v1)
                if (!v2)
                    v2 = this.putVertex(edge.v2)
                this.putEdge({v1,v2})
            }
        }
    }


    putVertex(vertex: Path_Metadata | {id: number, x: number, y: number}): number{ // returns -1 if the ID is already being used
        if (vertex instanceof Path_Metadata){
            let existing = this.map.get(vertex)
            if (existing === undefined){
                let index = this.smallest_free_id
                while (this.used_ids.has(index)){
                    index++
                }
                this.map.set(vertex, index)
                this.vertices.push(new Vertex(index, vertex.center().x, vertex.center().y))
                this.used_ids.add(index)
                this.smallest_free_id = index +1
                return index
            }
            return existing
        }
        else{
            if (this.used_ids.has(vertex.id)){
                return -1
            }
            else{
                this.vertices.push(new Vertex(vertex.id, vertex.x, vertex.y))
                this.used_ids.add(vertex.id)
                return vertex.id
            }
        }
    }

    // Returns the index of a vertex given its Path_Metadata representation or adds the vertex to the graph, returning the new index
    getOrPutVertex(vertex: Path_Metadata): number{
        const index = this.map.get(vertex)
        if(index)
            return index
        else 
            return this.putVertex(vertex)
    }

    
    putEdge(edge: {v1: number, v2: number}){
        if (edge.v1 == edge.v2) // Self Loop
            return
        if(this.edges.some(x => {(x.v1 == edge.v1 && x.v2 == edge.v2) || (x.v1 == edge.v2 && x.v2 == edge.v1)})) // equivalent edge already registered
           return
        this.edges.push(edge) 
    }


    toAdjacencyMatrix(){
        let sorted_vertices = [... this.vertices].sort((a,b) => a.id - b.id)
        const n = this.vertices.length
        const adjacency = Array.from({length: n}, () => Array(n).fill(0)) // all entries 0 at first
        const index_map = new Map<number, number>()
        sorted_vertices.forEach( (v,i) => index_map.set(v.id, i))
        for (const edge of this.edges){
            let i1 = index_map.get(edge.v1)!
            let i2 = index_map.get(edge.v2)!
            adjacency[i1]![i2] = 1
            adjacency[i2]![i1] = 1
        }
        return adjacency
    }


    toGraph6(){//TODO

    }
    

    hasEdges(threshold: number = 1){
        if (this.edges.length < threshold)
            return false
        else return true
    }


    hasVertices(threshold: number = 1){
        if(this.smallest_free_id < threshold)
            return false
        else return true
    }


    toString(){
        const edges:string[] = []
        const vertices: string[] = []
        this.edges.forEach(x => {edges.push(x.v1 + " -- " + x.v2)})
        this.vertices.forEach(x => {vertices.push("v"+x.id + " ["+x.x_pos+", "+x.y_pos+"]")})
        return this.metadata.join("\n")+"\nVertices: "+this.vertices.length+"\n"+vertices.join("\n")+"\nEdges: "+this.edges.length+"\n"+edges.join("\n")
    }
}


export class Stroke{
    type: "line" | "curve"
    stroke: mupdf.StrokeState
    start: {x: number, y: number}
    end: {x: number, y:number}
    control_pts?: {x: number, y: number} []

    start_incident?: (Stroke | Path_Metadata)
    end_incident?: (Stroke | Path_Metadata)


    constructor(type: "line" | "curve", stroke: mupdf.StrokeState, points: {x: number, y: number}[]){
        this.type = type
        this.stroke = stroke
        if (type == "line" &&  points.length == 2){
            this.start = points[0]!
            this.end = points[1]!
        }
    

        else if (type == "curve" && points.length == 4){
            this.start = points[0]!
            this.end = points[3]!
            this.control_pts = [points[1]!, points[2]!]
        }
        else throw new Error("points must contain two points for a line or four points for a curve")
    }


    traverse(from: Stroke | Path_Metadata){ //given an endpoint of the stroke, gives back the other end
        if (this.start_incident == from)
            return this.end_incident
        else if(this.end_incident == from)
            return this.start_incident
        else return undefined
    }


    split_in_pnt(x: number, y: number){
        if (this.type === "curve"){
            console.log("Warning: Trying to split curve type vertex, no implementation yet!")
            return undefined
        }
        else{
            const e1 = new Stroke("line", this.stroke, [this.start, {x,y}])
            const e2 = new Stroke("line", this.stroke, [{x,y}, this.end])
            return {e1, e2}
        }
    }


    toString(){
        return "Type: " + this.type + " Start: " + this.start.x + " "+ this.start.y + " End: " + this.end.x + " " + this.end.y
    }
}


export class Path_Metadata{
    path: mupdf.Path
    bounds: mupdf.Rect
    ctm: mupdf.Matrix
    type: "fill" | "stroke"
    stroke?: mupdf.StrokeState
    

    constructor(path: mupdf.Path, bounds: mupdf.Rect, ctm: mupdf.Matrix, type: "fill" | "stroke", stroke?: mupdf.StrokeState) {
        this.path = path
        this.bounds = bounds
        this.ctm = ctm
        this.type = type
        if (stroke)
            this.stroke = stroke
    }


    toString(){
        return "Type: "+ this.type + " Center: " + this.center().x + " "+ this.center().y + " Area: " + this.area()
    }


    height_width_ratio(){
        const width = this.bounds[2] - this.bounds[0]
        const height = this.bounds[3] - this.bounds[1]
        if (width != 0)
            return height / width
        else return 0
    }


    area(){
        return (this.bounds[2] - this.bounds[0]) * (this.bounds[3] - this.bounds[1])
    }  


    center(){
        return {x: (this.bounds[2] + this.bounds[0]) / 2, y: (this.bounds[3] + this.bounds[1]) / 2}
    }
}


export class Drawing{
    paths: Path_Metadata[]
    minX: number
    minY: number
    maxX: number
    maxY: number


    constructor(paths: Path_Metadata[], bounds?: mupdf.Rect){
        this.paths = paths
        if (bounds){
            this.minX = bounds[0]
            this.minY = bounds[1]
            this.maxX = bounds[2]
            this.maxY = bounds[3]
        }
        else{
            if (paths.length == 0){
                this.minX = 0
                this.maxX = 0
                this.minY = 0
                this.maxY = 0
            }
            else{
                let x_min = Infinity
                let y_min = Infinity
                let x_max = -Infinity
                let y_max = -Infinity
                for (var path of paths){
                    let bb = path.bounds
                    var x1 = bb[0]
                    var y1 = bb[1]
                    var x2 = bb[2]
                    var y2 = bb[3]
                    if (x_min > x1)
                        x_min = x1
                    if (y_min > y1)
                        y_min = y1
                    if (x_max < x2)
                        x_max = x2
                    if (y_max < y2)
                        y_max = y2
                }
                this.minX = x_min
                this.minY = y_min
                this.maxX = x_max
                this.maxY = y_max
            }
        }
    }


    static merge(d1: Drawing, d2: Drawing): Drawing{
        //fs.appendFileSync("test_files/log.txt", "merging two Drawings, D1: "+d1.paths.toString() + "\nD2: "+ d2.paths.toString()+"\n")
        const mergedPaths = [...d1.paths, ...d2.paths];

        const minX = Math.min(d1.minX, d2.minX);
        const minY = Math.min(d1.minY, d2.minY);
        const maxX = Math.max(d1.maxX, d2.maxX);
        const maxY = Math.max(d1.maxY, d2.maxY);

        return new Drawing(mergedPaths, [minX, minY, maxX, maxY]);
    }


    toString(){
        return "Drawing with "+this.paths.length +" paths: "+ this.paths.toString() +"\n" + "Bounding Box: [" +this.minX + ","+this.minY+" | " + this.maxX + " " + this.maxY +"]\n"
    }


    getBounds(){
        return  [this.minX, this.minY, this.maxX, this.maxY] as mupdf.Rect
    }


    area(){
        return (this.maxX - this.minX) * (this.maxY - this.minY)
    }
}