import { wasm } from "@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.mjs";

function decodeBase64Wasm(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

const module = WebAssembly.compile(decodeBase64Wasm(wasm));

export default module;
