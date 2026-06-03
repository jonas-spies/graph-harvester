import { execute_file } from "../src/pipeline.js";

function main(){
    const input = document.getElementById("pdfInput") as HTMLInputElement;

    input.addEventListener("change", async () => {
        const file = input.files?.[0]
        if (!file)
            return
        const buffer = await file.arrayBuffer()
        execute_file(buffer)
    });
}

main()