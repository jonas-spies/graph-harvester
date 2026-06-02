import * as mupdf from 'mupdf'


export class Stroke{
    type: "line" | "curve"
    width: number
    start: {x: number, y: number}
    end: {x: number, y:number}
    control_pts?: {x: number, y: number} []


    constructor(type: "line" | "curve", width: number, points: {x: number, y: number}[]){
        this.type = type
        this.width = width
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