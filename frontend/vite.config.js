import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({root:fileURLToPath(new URL(".",import.meta.url)),server:{host:"127.0.0.1",port:5173,proxy:{"/api":"http://127.0.0.1:8787"}},build:{outDir:"dist",emptyOutDir:true}});
