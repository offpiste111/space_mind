// This file exists to help Eel's static analyzer find exposed functions
// that are otherwise mangled by the build process (Vite/Rollup).

if (false) {
    eel.expose(null, 'say_hello_js');
    eel.expose(null, 'get_graph_data');
    eel.expose(null, 'reset_graph');
}
