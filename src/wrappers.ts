import * as mupdf from 'mupdf'
import * as utils from './geometry_utils.js'


const default_stroke = new mupdf.StrokeState({
                    lineCap: "Square",
                    lineJoin: "Bevel",
                    lineWidth: 2.0,
                    miterLimit: 1.414,
                    dashPhase: 11
                    })


export class Edge{
    v1: Vertex
    v2: Vertex
    path: Stroke[]

    constructor(v1: Vertex, v2: Vertex, path?: Stroke[]){
        this.v1 = v1
        this.v2 = v2
        if (path)
            this.path = path
        else{
            this.path = [new Stroke("line", default_stroke, [v1.pos, v2.pos])]
        }
    }
}


export class Vertex{
    pos: Point
    id: number
    metadata: Path_Metadata

    constructor(id: number, x: number, y: number, metadata?: Path_Metadata){
        this.id = id
        this.pos = {x, y} 
        if (metadata)
            this.metadata = metadata
        else
            this.metadata = Path_Metadata.default(this.pos)
    }
}


export class Graph{
    edges: Edge []
    private map: Map<Path_Metadata, number>
    vertices: Vertex[]
    private smallest_free_id: number
    private used_ids: Set<number>
    metadata: string[]
    // Minimum size a Graph needs to be in order to not be rejected (last model used 4 Edges, 5 Vertices)s
    static readonly MINIMUM_EDGES = 4
    static readonly MINIMUM_VERTICES = 5

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
                this.vertices.push(new Vertex(index++, v.center().x, v.center().y, v))
            }
        }
        this.smallest_free_id = index
        if(edges){
            for (const edge of edges){
                let v1_id = this.map.get(edge.v1)
                let v2_id = this.map.get(edge.v2)
                if (!v1_id)
                    v1_id =this.putVertex(edge.v1)
                if (!v2_id)
                    v2_id = this.putVertex(edge.v2)
                this.putEdge({v1_id , v2_id})
            }
        }
    }

    /** Checks if an equivalent vertex already exists and only adds the vertex if the answer is no.
    @returns the ID of the vertex or -1 if the specified ID is already in use */
    putVertex(vertex: Path_Metadata | Vertex ): number{
        if (vertex instanceof Path_Metadata){
            let existing = this.map.get(vertex)
            if (existing === undefined){
                let index = this.smallest_free_id
                while (this.used_ids.has(index)){
                    index++
                }
                this.map.set(vertex, index)
                this.vertices.push(new Vertex(index, vertex.center().x, vertex.center().y, vertex))
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
                this.vertices.push(vertex)
                this.used_ids.add(vertex.id)
                return vertex.id
            }
        }
    }


    /**Returns the index of a vertex given its Path_Metadata representation or adds the vertex to the graph (kind of obsolete because putVertex does the same thing)*/
    getOrPutVertex(vertex: Path_Metadata): number{
        const index = this.map.get(vertex)
        if(index)
            return index
        else 
            return this.putVertex(vertex)
    }


    /** Takes the ID of the start and endpoint and adds the edge to the graph, as long as no equivalent edge exists in the graph and the edge is not a self loop */
    putEdge(edge: Edge | {v1_id: number, v2_id: number, path?: Stroke[]}){
        if (edge instanceof Edge){
            if (this.edges.find(x => x === edge))
                return
            this.edges.push(edge)
        }
        else{
        if (edge.v1_id == edge.v2_id) // Self Loop
            return
        let v1 = this.vertices.find(x => x.id == edge.v1_id)
        let v2 = this.vertices.find(x => x.id == edge.v2_id) // TODO a bit inefficient
        if(this.edges.some(x => {return (x.v1.id == edge.v1_id && x.v2.id == edge.v2_id) || (x.v1.id == edge.v2_id && x.v2.id == edge.v1_id)})) // equivalent edge already registered
           return
        if (v1 && v2)
            this.edges.push(new Edge(v1,v2, edge.path)) 
        }
    }


    /** Returns a n x n matrix whereas n is the number of vertices in the graph. A 1 entry in i,j implies an edge between vertex i and vertex j (IDs sorted in increasing order) */
    toAdjacencyMatrix(): number[][]{
        let sorted_vertices = [... this.vertices].sort((a,b) => a.id - b.id)
        const n = this.vertices.length
        const adjacency: number[][] = Array.from({length: n}, () => Array(n).fill(0)) // all entries 0 at first
        const index_map = new Map<number, number>()
        sorted_vertices.forEach( (v,i) => index_map.set(v.id, i))
        for (const edge of this.edges){
            let i1 = index_map.get(edge.v1.id)!
            let i2 = index_map.get(edge.v2.id)!
            adjacency[i1]![i2] = 1
            adjacency[i2]![i1] = 1
        }
        return adjacency
    }


    toGraph6(): string{
        function encode_bits(bits:  number[]): string{
            let result: string[] = []
            // Pad length to multiple of 6
            while(bits.length % 6 !== 0)
                bits.push(0)
            // Group Array into groups of 6
            for (let i = 0; i < bits.length; i+=6){
                let value = 0
                for (let b = 0; b<6; b++){
                    value = (value << 1) | bits[i+b]!
                }
                result.push(String.fromCharCode(value+63))
            }
            return result.join("")
        }
        let adj = this.toAdjacencyMatrix()
        const n = adj.length
        var result: string = ""
        if (n < 63)
            result += String.fromCharCode(n+63)
        else if (n >= 63 && n <= 258047){
            const header_bits = n.toString(2).padStart(18,"0").split("").map(Number)
            result+=("~"+encode_bits(header_bits))
        }
        else if (n > 258047){
            const header_bits = n.toString(2).padStart(36,"0").split("").map(Number)
            result+=("~~"+encode_bits(header_bits))
        }
        const body_bits: number[] = []
        // Get all bits
        for (let i = 0; i <n; i++){
            for (let j = i+1; j <n; j++){
                body_bits.push(adj[i]![j]!)
            }
        }
        result += encode_bits(body_bits)
        return result
    }


    /** Returns true if the Graph has at least theshold many edges */
    hasEdges(threshold: number = 1){
        if (this.edges.length < threshold)
            return false
        else return true
    }


    /** Returns true if the Graph has at least theshold many vertices */
    hasVertices(threshold: number = 1){
        if(this.vertices.length < threshold)
            return false
        else return true
    }

    
    /** Performs DFS find all connected components and returns a list containing a graph for each connected component.*/
    split_disconnected_components(): Graph[]{
        const visited : Set<Vertex | Edge> = new Set<Vertex | Edge>()
        const graphs : Graph[] = []
        for (const vertex of this.vertices){ // for every vertex, do DFS
            if (visited.has(vertex)) // already part of some graph, so skip
                continue
            const graph = new Graph()
            const vertices: Vertex[] = [vertex]
            while (vertices.length > 0){ // actual DFS
                let next = vertices.pop()!
                if(!visited.has(next)){
                    visited.add(next)
                    graph.putVertex(next)
                }
                let edge = this.edges.find((edge) => (edge.v1.id == next.id || edge.v2.id == next.id) && !visited.has(edge)) //An arbitrary edge that has not yet been visited
                if (edge){
                    visited.add(edge)
                    let other_id = (next.id == edge.v1.id)? edge.v2.id : edge.v1.id
                    let other = this.vertices.find(v => v.id == other_id)
                    if (other){
                        graph.putVertex(other)
                        graph.putEdge(edge)
                        visited.add(other)
                        vertices.push(next)
                        vertices.push(other)
                    }
                    else
                        console.log("Found an edge with phantom vertex")
                    }
                else { // Vertex has no unseen edges
                    continue
                }
            }
            if (graph.hasEdges(Graph.MINIMUM_EDGES) && graph.hasVertices(Graph.MINIMUM_VERTICES)){
                graphs.push(graph)
            }
            else{
                //console.log("Rejected graph with "+graph.edges.length+" edges and "+ graph.vertices.length+" vertices.")
            }

        }
        return graphs
    }


    toString(){
        const edges:string[] = []
        const vertices: string[] = []
        this.edges.forEach(x => {edges.push(x.v1.id + " -- " + x.v2.id)})
        this.vertices.forEach(x => {vertices.push("v"+x.id + " ["+x.pos.x+", "+x.pos.y+"]")})
        return this.metadata.join("\n")+"\nVertices: "+this.vertices.length+"\n"+vertices.join("\n")+"\nEdges: "+this.edges.length+"\n"+edges.join("\n")
    }


    async get_hog_id(){
        const url = "https://houseofgraphs.org/api/enquiry"
        const graph6 = this.toGraph6()

        const payload = {
            "canonicalFormEnquiry": {"canonicalForm": graph6},
            "formulaEnquiries": [],
            "graphClassEnquiries": [],
            "interestingInvariantEnquiries": [],
            "invariantEnquiries": [],
            "invariantParityEnquiries": [],
            "invariantRangeEnquiries": [],
            "mostPopular": -1,
            "mostRecent": -1,
            "subgraphEnquiries": [],
            "textEnquiries": [],
        }
        let response: Response;
        try{
            response = await fetch(url, {
                method: "POST", 
                headers:{"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            })
        }
        catch(err){
            throw new Error("Request to HoG failed")
        }
        const data = await response.json()
        if (data.totalCandidates > 1)
            throw new Error("WARNING: More than one candidate returned")
        if (data.totalCandidates === 0)
            return null
        return data._embedded.graphSearchModelList[0].graphId;
    }


    static toDetectedGraph(graphs: Graph[], drawing: Drawing){
        const n = graphs.length
        const img : string = utils.pngBytesToBase64(drawing.toPNG(2))
        const boundingBox: readonly [number, number, number, number] = drawing.getBounds()
        const caption: string = "" // no caption extraction implemented

        const graph6_strings: string[] = []
        const circles: Circle[][] = []  
        const rects: Rectangle[][]=  []  
        const lines: Line[] = []
        const beziers: Bezier[] = []
        const hog_ids: number[] = [] // TODO: make a function that asks HOG
        for (const graph of graphs){
            graph6_strings.push(graph.toGraph6())
            hog_ids.push(Number(graph.get_hog_id()))
            const next_circles = []
            const next_rects = []
            for (const vertex of graph.vertices){
                if (vertex.metadata.shape == "circle"){
                    next_circles.push({radius: vertex.pos.x - vertex.metadata.minX, center: vertex.pos, index: vertex.id} as Circle)
                }
                else { // Technically could be a Path, but at that point something went wrong already, so probably fine to just treat both cases as Rectangle
                    const bounds = vertex.metadata.getBounds()
                    next_rects.push({topLeft: {x: bounds[0], y: bounds[1]}, bottomRight: {x: bounds[2], y: bounds[3]}, index: vertex.id} as Rectangle)
                }
            }
            circles.push(next_circles)
            rects.push(next_rects)
            for (const edge of graph.edges){
                for (const stroke of edge.path){
                    if (stroke.type == "curve"){
                        beziers.push({start: stroke.start, stop: stroke.end, p1: stroke.control_pts![0], p2: stroke.control_pts![1]} as Bezier)
                    }
                    else{
                        lines.push({start: stroke.start, stop: stroke.end} as Line)
                    }
                }
            }
        }
        return {graph6_strings, img, boundingBox, caption, circles, rects, lines, beziers, hog_ids, connected_components: graphs} as DetectedGraph
    }
}

/** Currently used for edge candidates */
export class Stroke{
    type: "line" | "curve"
    stroke: mupdf.StrokeState
    start: Point
    end: Point
    control_pts?: {x: number, y: number} []

    start_incident?: (Stroke | Path_Metadata)
    end_incident?: (Stroke | Path_Metadata)


    constructor(type: "line" | "curve", stroke: mupdf.StrokeState, points: Point[]){
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


    /**Given an endpoint of the stroke, returns the other end */
    traverse(from: Stroke | Path_Metadata){
        if (this.start_incident == from)
            return this.end_incident
        else if(this.end_incident == from)
            return this.start_incident
        else return undefined
    }


    /** Currently not in use, and not really usable as it is now */
    split_in_pnt(x: number, y: number, t: number): {e1: Stroke, e2: Stroke}{
        if (this.type === "curve"){
            throw new Error("No implementation for splitting curve type edge")
        }
        else{
            let point = this.walk_along_edge(t)
            if (point.x != x || point.y != y)
                console.log("Split in point: got x:"+x+" y:"+y+" but t yielded x:"+point.x + " y:"+point.y)
            const e1 = new Stroke("line", this.stroke, [this.start, {x,y}])
            const e2 = new Stroke("line", this.stroke, [{x,y}, this.end])
            return {e1, e2}
        }
    }


    toString(){
        return "Type: " + this.type + " Start: " + this.start.x + " "+ this.start.y + " End: " + this.end.x + " " + this.end.y
    }


    /** Splits the edge into multiple sample points in same-length increments (the last two points might be apart up to twice as far)
     @input resolution specifies the number of sample points that should be created */
    toPolyLine(resoltuion: number): {x: number, y: number}[]{
        let increment = 1 / resoltuion
        var t = increment
        let points: {x: number, y: number}[] = [this.start]
        while (t < (1 - increment)){ // ensures that the last segment is at least increment long
            points.push(this.walk_along_edge(t))
            t += increment
        }
        points.push(this.end)
        return points
    }


    /** Interprets the Stroke as a trajectory function f(t) where f(0) is the start point and f(1) is the end point. Given t, it returns the corresponding point on the Stroke */
    walk_along_edge(t: number): {x: number, y: number} {
        if (t > 1 || t < 0) // Will probably remove this check because it seems like an easy way to ''extend'' the line in a certain direction
            throw new Error("Illegal argument for t")
        if (this.type == "line"){
            let x = this.start.x * t + this.end.x * (1-t)
            let y = this.start.y * t + this.end.y * (1-t)
            return {x,y}
        }
        let p0: {x: number, y: number} = this.start
        let p1: {x: number, y: number} = this.control_pts![0]!
        let p2: {x: number, y: number} = this.control_pts![1]!
        let p3: {x: number, y: number} = this.end
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
}


/** Currently used ambiguously as either a single Path object, which is part of a Drawing, or as a vertex candidate */
export class Path_Metadata{
    path: mupdf.Path
    minX: number
    minY: number
    maxX: number
    maxY: number
    ctm: mupdf.Matrix
    type: "fill" | "stroke"
    shape?: "circle" | "rectangle" | "path"
    stroke?: mupdf.StrokeState
    evenOdd?: boolean
    colorSpace: mupdf.ColorSpace
    color: mupdf.Color
    alpha: number
    

    constructor(path: mupdf.Path, bounds: mupdf.Rect, ctm: mupdf.Matrix, type: "fill" | "stroke", colorSpace: mupdf.ColorSpace, color: mupdf.Color, alpha: number, stroke?: mupdf.StrokeState, evenOdd?: boolean, shape?: "circle" | "rectangle" | "path") {
        this.path = path
        this.minX = bounds[0]
        this.minY = bounds[1]
        this.maxX = bounds[2]
        this.maxY = bounds[3]
        this.ctm = ctm
        this.type = type
        if (shape)
            this.shape = shape
        this.colorSpace = colorSpace
        this.color = color
        this.alpha = alpha
        if (stroke)
            this.stroke = stroke
        if (evenOdd)
            this.evenOdd = evenOdd
    }


    toString(){
        return "Type: "+ this.type + " Center: " + this.center().x + " "+ this.center().y + " Area: " + this.area()
    }


    height_width_ratio(){
        const width = this.maxX - this.minX
        const height = this.maxY - this.minY
        if (width != 0)
            return height / width
        else return 0
    }


    area(){
        return (this.maxX - this.minX) * (this.maxY - this.minY)
    }  


    center(){
        return {x: (this.maxX + this.minX) / 2, y: (this.maxY + this.minY) / 2}
    }

    getBounds(){
        return [this.minX, this.minY, this.maxX, this.maxY] as mupdf.Rect
    }

    /** returns a Path_Metadata object with desired center position, size, and default configurations */
    static default(pos: Point, edge_length: number = 10){
        edge_length /= 2
        return new Path_Metadata(new mupdf.Path(), [pos.x - edge_length, pos.y - edge_length, pos.x + edge_length, pos.y + edge_length], mupdf.Matrix.identity, "fill", mupdf.ColorSpace.DeviceRGB, [0,1,0], 1, undefined, true, "rectangle",)
    }


    /** admittedly weird and makeshift function to merge two vertex candidates */
    static merge(p1: Path_Metadata, p2: Path_Metadata){
        let pos = { x: (p1.center().x + p2.center().x) /2, y: (p1.center().y + p2.center().y) /2} as Point
        let x_min = p1.minX < p2.minX? p1.minX : p2.minX
        let x_max = p1.maxX > p2.maxX? p1.maxX : p2.maxX
        let y_min = p1.minY < p2.minY? p1.minY : p2.minY
        let y_max = p1.maxY > p2.maxY? p1.maxY : p2.maxY
        let x_length = Math.abs(x_max - x_min)
        let y_length = Math.abs(y_max - y_min)
        let edge_length = x_length > y_length? x_length : y_length

        const is_dominating = p1.area() > p2.area()
        if((is_dominating && p1.shape === "circle") || (!is_dominating && p2.shape === "circle"))
            edge_length /= 1.12838 //make Rectangle smaller so that area stays the same
        return this.default(pos, edge_length)
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
                    let bb = path.getBounds()
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

    toPNG(scale: number = 5){
        const matrix = mupdf.Matrix.scale(scale,scale)
        let boundingbox = this.getBounds()
        let {x: x1,y: y1} = utils.transform_point(matrix, boundingbox[0], boundingbox[1])
        boundingbox[0] = x1
        boundingbox[1] = y1
        let {x: x2,y: y2} = utils.transform_point(matrix, boundingbox[2], boundingbox[3])
        boundingbox[2] = x2
        boundingbox[3] = y2
        const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, boundingbox, false)
        pixmap.clear(255)
        let drawDevice = new mupdf.DrawDevice(matrix, pixmap)
        
        for (var path of this.paths){
            switch (path.type){
                case "fill":
                    let evenOdd = path.evenOdd? path.evenOdd : true
                    drawDevice.fillPath(path.path, evenOdd, path.ctm, path.colorSpace, path.color, path.alpha)
                    continue
                case "stroke":
                    drawDevice.strokePath(path.path, path.stroke? path.stroke : default_stroke,path.ctm,path.colorSpace, path.color, path.alpha)
            }
        }
    return pixmap.asPNG()
    }
}

//COPY PASTED FROM FRONTEND + keeps a Graph object for every connected component
export interface DetectedGraph {
  graph6_strings: string[]
  circles: Circle[][]   
  rects: Rectangle[][]  
  lines: Line[] 
  beziers: Bezier[] 
  boundingBox: readonly [number, number, number, number] 
  caption: string // (currently using empty string)
  img: string
  hog_ids: number[] // TODO: make a function that asks HOG
  connected_components: Graph[]
}


export interface Circle {
  radius: number
  center: Point
  index: number
}


export interface Rectangle {
  topLeft: Point
  bottomRight: Point
  index: number
}


export interface Line {
  start: Point
  stop: Point
}


export interface Bezier {
  start: Point
  p1: Point
  p2: Point
  stop: Point
}


export interface Point{
    x : number
    y : number
}