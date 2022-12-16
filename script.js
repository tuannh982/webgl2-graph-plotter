// ----------------------------------------------------------------
const base_vs = `#version 300 es
in vec4 a_position;
void main() {
    gl_Position = a_position;
}
`
const axis_fs_shader = `#version 300 es
precision mediump float;

// uniforms
uniform vec3 bg_color;
uniform vec3 line_color;
uniform vec2 resolution;
uniform sampler2D prev_texture;
uniform float zoom;
uniform int enable_grid;

// out color
out vec4 out_color;

vec3 render(in vec2 frag_coord) {
    vec3 color = bg_color;
    vec2 uv = (2. * frag_coord - resolution) / min(resolution.x, resolution.y);

    uv = uv * zoom;

    color = max(color, texture(prev_texture, frag_coord / resolution).xyz);
    
    float width = 1. / min(resolution.x, resolution.y) * zoom;

    float m = 3.5;
    
    float vertical_axis = step(abs(uv.x), m * width);
    float horizontal_axis = step(abs(uv.y), m * width);

    if (vertical_axis > 0. || horizontal_axis > 0.) {
        color = line_color;
    }
    
    return color;
}

void main() {
    vec3 color = render(gl_FragCoord.xy);
    out_color = vec4(color, 1);
}
`

const grid_fs_shader = `#version 300 es
precision mediump float;

// uniforms
uniform vec3 bg_color;
uniform vec3 line_color;
uniform vec2 resolution;
uniform sampler2D prev_texture;
uniform float zoom;
uniform int enable_grid;

// out color
out vec4 out_color;

vec3 render(in vec2 frag_coord) {
    vec3 color = bg_color;
    vec2 uv = (2. * frag_coord - resolution) / min(resolution.x, resolution.y);

    uv = uv * zoom;

    color = max(color, texture(prev_texture, frag_coord / resolution).xyz);
    
    float width = 1. / min(resolution.x, resolution.y) * zoom;

    float m = 2.;
    
    float vertical_lines = step(fract(uv.x), m * width);
    float horizontal_lines = step(fract(uv.y), m * width);

    if (vertical_lines > 0. || horizontal_lines > 0.) {
        color = line_color;
    }
    
    return color;
}

void main() {
    vec3 color = render(gl_FragCoord.xy);
    out_color = vec4(color, 1);
}
`

function gen_1d_fs_shader(func_src) {
    return `#version 300 es

    precision mediump float;
    
    // uniforms
    uniform vec3 bg_color;
    uniform vec3 line_color;
    uniform vec2 resolution;
    uniform sampler2D prev_texture;
    uniform float zoom;
    uniform int enable_range;
    uniform vec2 continuous_range;
    
    // out color
    out vec4 out_color;
    
    float f(in float x) {
        {${func_src}}
    }
    
    float grad(in float x) {
        float h = 0.001;
        return (f(x + h) - f(x - h)) / (2.0 * h);
    }
    
    float de(in vec2 p) {
        float v = f(p.x) - p.y;
        float g = 1. + pow(grad(p.x), 2.);
        float de = abs(v) / sqrt(g); 
        return de;
    }
    
    vec3 render(in vec2 frag_coord) {
        vec3 color = bg_color;
        vec2 uv = (2. * frag_coord - resolution) / min(resolution.x, resolution.y);
    
        uv = uv * zoom;
    
        color = max(color, texture(prev_texture, frag_coord / resolution).xyz);
        
        bool should_render = false;
        should_render = should_render ||
            (enable_range == 1 && 
            uv.x >= continuous_range.x && 
            uv.x <= continuous_range.y);
        should_render = should_render ||
            (enable_range == 0);
        
        if (should_render) {
            color = mix(
                color,
                line_color,
                1.0 - smoothstep(0.0, ${variables.pix_size * variables.stroke_scale} * zoom, de(uv))
            );
        }
    
        return color;
    }
    
    void main() {
        vec3 color = render(gl_FragCoord.xy);
        out_color = vec4(color, 1);
    }
    `
}

function gen_2d_fs_shader(func_src) {
    return `#version 300 es

    precision mediump float;
    
    // uniforms
    uniform vec3 bg_color;
    uniform vec3 line_color;
    uniform vec2 resolution;
    uniform sampler2D prev_texture;
    uniform float zoom;
    uniform int enable_range;
    uniform vec2 continuous_range;
    
    // out color
    out vec4 out_color;
    
    float f(in vec2 p) {
        float x = p.x;
        float y = p.y;
        {${func_src}}
    }
    
    vec2 grad(in vec2 p) {
        float h = 0.001;
        return vec2(
            f(p + vec2(h, 0.)) - f(p - vec2(h, 0.)), 
            f(p + vec2(0., h)) - f(p - vec2(0., h))
        ) / (2. * h);
    }
    
    float de(in vec2 p) {
        float v = f(p);
        vec2 g = grad(p);
        float de = abs(v) / length(g); 
        return de;
    }
    
    vec3 render(in vec2 frag_coord) {
        vec3 color = bg_color;
        vec2 uv = (2. * frag_coord - resolution) / min(resolution.x, resolution.y);
    
        uv = uv * zoom;
    
        color = max(color, texture(prev_texture, frag_coord / resolution).xyz);
        
        bool should_render = false;
        should_render = should_render ||
            (enable_range == 1 && 
            uv.x >= continuous_range.x && 
            uv.x <= continuous_range.y);
        should_render = should_render ||
            (enable_range == 0);
        
        if (should_render) {
            color = mix(
                color,
                line_color,
                1.0 - smoothstep(0.0, ${variables.pix_size * variables.stroke_scale} * zoom, de(uv))
            );
        }
    
        return color;
    }
    
    void main() {
        vec3 color = render(gl_FragCoord.xy);
        out_color = vec4(color, 1);
    }
    `
}

// ----------------------------------------------------------------

function gl_clear(bg_color) {
    gl.clearColor(bg_color[0], bg_color[1], bg_color[2], 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.clearDepth(1.0)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
}

function gl_compile_shader(type, source) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
}

function gl_compile_program(vs, fs, attributes, uniforms, detach=false) {
    const vs_shader = gl_compile_shader(gl.VERTEX_SHADER, vs)
    const fs_shader = gl_compile_shader(gl.FRAGMENT_SHADER, fs)
    const program = gl.createProgram()
    gl.attachShader(program, vs_shader)
    gl.attachShader(program, fs_shader)
    if (!gl.getShaderParameter(vs_shader, gl.COMPILE_STATUS)) {
        throw {
            "msg": "error while compiling vertex shader",
            "src": vs
        }
    }
    if (!gl.getShaderParameter(fs_shader, gl.COMPILE_STATUS)) {
        throw {
            "msg": "error while compiling fragment shader",
            "src": fs
        }
    }
    gl.linkProgram(program)
    let attribute_locs = {}
    let uniform_locs = {}
    for (let attribute of attributes) {
        attribute_locs[attribute] = gl.getAttribLocation(program, attribute)
    }
    for (let uniform of uniforms) {
        uniform_locs[uniform] = gl.getUniformLocation(program, uniform)
    }
    if (detach) {
        gl.detachShader(program, vs_shader)
        gl.deleteShader(vs_shader)
        gl.detachShader(program, fs_shader)
        gl.deleteShader(fs_shader)
    }
    return {
        "program": program,
        "attributes": attribute_locs,
        "uniforms": uniform_locs
    }
}

function gl_create_vao() {
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    return vao
}

function gl_set_vaa(data, attribute_location) {
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(attribute_location)
    gl.vertexAttribPointer(attribute_location, 4, gl.FLOAT, false, 0, 0)
    return buffer
}

function gl_init_texture(data = null) {
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.canvas.width,
        gl.canvas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data
    )
    return texture
}
function gl_init_render_target() {
    const texture = gl_init_texture()
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    return {
        "texture": texture,
        "fbo": fbo
    }
}

function gl_set_texture(texture, location, spot) {
    gl.activeTexture(gl.TEXTURE0 + spot)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(location, spot)
}

// ----------------------------------------------------------------

function setup_control_panel() {
    // setup debug panel
    if (!variables.debug) {
        debug_container.setAttribute("hidden", "true")
    }
    // setup sliders
    let item
    const sliders = control_panel.querySelectorAll(".slider-control")
    for (item of sliders) {
        const s = item.querySelector(".input")
        const v = item.querySelector(".value")
        const ss = item.querySelector(".field-selector").textContent
        s.value = variables[ss]
        v.innerText = s.value
        s.oninput = function () {
            variables[ss] = this.value
            v.innerText = this.value
            //
            update_and_render_functions()
        }
    }
    // setup checkboxes
    const checkboxes = control_panel.querySelectorAll(".toggle-control")
    for (item of checkboxes) {
        const s = item.querySelector(".input")
        const ss = item.querySelector(".field-selector").textContent
        s.checked = variables[ss]
        s.oninput = function () {
            variables[ss] = s.checked
            //
            update_and_render_functions()
        }
    }
    // setup buttons
    const buttons = control_panel.querySelectorAll(".button-control")
    for (item of buttons) {
        const s = item.querySelector("button")
        const ss = item.querySelector(".field-selector").textContent
        s.onclick = function () {
            // noinspection BadExpressionStatementJS,JSValidateTypes
            window[ss]()
        }
    }
}

// ----------------------------------------------------------------
class LineFsShader {
    constructor(src, color, continuous_range=null) {
        this.src = src
        this.color = color
        this.continuous_range = continuous_range
    }
}

class BaseFunction {
    constructor(formula, color, continuous_range=null) {
        this.formula = formula
        this.color = color
        this.continuous_range = continuous_range
    }

    to_fs_shader() {
        throw new Error("not implemented")
    }
}
class Function1D extends BaseFunction {
    to_fs_shader() {
        return new LineFsShader(
            gen_1d_fs_shader(this.formula),
            this.color,
            this.continuous_range
        )
    }
}

class Function2D extends BaseFunction {
    to_fs_shader() {
        return new LineFsShader(
            gen_2d_fs_shader(this.formula),
            this.color,
            this.continuous_range
        )
    }
}

function ui_add_function_row(
    formula = "return 1.;",
    color = "[1,1,0]",
    range = null,
    enable = true,
    is_1d = true
) {
    const functions = control_panel.querySelector("#function-container > .function-area")
    const node = document.createElement("div")
    node.setAttribute("class", "function control")
    node.innerHTML =
        `
        <p class="item-header">function:</p>
        <textarea rows="1" class="formula" onchange="update_and_render_functions()">${formula}</textarea>
        <p class="item-header">color:</p>
        <input type="text" class="color" onchange="update_and_render_functions()" value="${color}">
        <p class="item-header">range:</p>
        <input type="text" class="range" onchange="update_and_render_functions()" value="${range ? range : ""}">
        <p class="item-header">enable:</p>
        <input type="checkbox" class="enable" onchange="update_and_render_functions()" ${enable ? "checked": ""}>
        <p class="item-header">is 1D:</p>
        <input type="checkbox" class="is-1d" onchange="update_and_render_functions()" ${is_1d ? "checked": ""}>
        `
    functions.appendChild(node)
    update_and_render_functions()
}

function ui_remove_function_row() {
    const functions = control_panel.querySelector("#function-container > .function-area")
    functions.removeChild(functions.lastChild)
    update_and_render_functions()
}

function update_and_render_functions() {
    const functions = control_panel.querySelectorAll("#function-container > .function-area > div.function")
    variables.functions = []
    let item
    for (item of functions) {
        try {
            const b = item.querySelector("input.enable").checked
            if (b) {
                const f = item.querySelector("textarea.formula").value
                const c = eval(item.querySelector("input.color").value)
                const r = eval(item.querySelector("input.range").value)
                const is_1d = item.querySelector("input.is-1d").checked
                if (is_1d) {
                    variables.functions.push(new Function1D(f, c, r === "" ? null : r))
                } else {
                    variables.functions.push(new Function2D(f, c, r === "" ? null : r))
                }
            }
        } catch (e) {
            console.error(e)
        }
    }
    if (variables.static_render) {
        render_loop()
    }
}

// ----------------------------------------------------------------

// ----------------------------------------------------------------
const root_container = document.querySelector("#root-container")
const canvas = root_container.querySelector("#canvas-container > #canvas")
const debug_container = root_container.querySelector("#debug-container")
const debug_p = debug_container.querySelector("#debug_p")
const control_panel = root_container.querySelector("#control-container")
// ----------------------------------------------------------------
// gl context
const gl = canvas.getContext('webgl2')
// vars
const variables = {
    display_width: "100",
    display_height: "70",
    pix_size: 0,
    stroke_scale: 2.5,
    debug: false,
    static_render: true,
    render_scale: 0.8,
    bg_color: [0,0,0],
    axis_color: [0.8,0.8,0.8],
    grid_color: [0.6,0.6,0.6],
    enable_grid: false,
    zoom: 10.0,
    functions: [],
}
let render_count = 0
let time = Date.now()
let elapsed_time = 0
let running = true

function line_fs_shaders() {
    let arr = []
    arr.push(new LineFsShader(axis_fs_shader, variables.axis_color))
    if (variables.enable_grid) {
        arr.push(new LineFsShader(grid_fs_shader, variables.grid_color))
    }
    for (let f of variables.functions) {
        arr.push(f.to_fs_shader())
    }
    return arr
}
// ----------------------------------------------------------------
setup_control_panel()

function update_global_vars() {
    render_count++
    const new_time = Date.now()
    const dt = new_time - time
    time = new_time
    elapsed_time += dt
}
function setup() {
    canvas.style.width = variables.display_width + "%"
    canvas.style.height = variables.display_height + "vh"
    const parent_div = canvas.parentElement
    const whole_document = document.documentElement
    canvas.width = 0.01 * variables.display_width * parent_div.clientWidth * variables.render_scale
    canvas.height = 0.01 * variables.display_height * whole_document.clientHeight * variables.render_scale
    console.info({canvas_size: {width: canvas.width, height: canvas.height}})
    variables.pix_size = 1 / Math.min(canvas.width, canvas.height)
    gl_clear(variables.bg_color)
}

function show_debug() {
    debug_p.innerText =
        `display_size: ${canvas.style.width} x ${canvas.style.height}
        render_size: ${gl.canvas.width}x${gl.canvas.height}
        fps: ${(1000 * render_count / elapsed_time).toFixed(2)}
        rendered: ${render_count}
        elapsed_time: ${(elapsed_time / 1000).toFixed(2)}
        `
}

function render_line_fs_shaders(line_fs_shaders) {
    let last_texture = gl_init_texture()
    let last_render_target = null
    let last_prog = null

    const f_len = line_fs_shaders.length
    for (let i in line_fs_shaders) {
        try {
            if (last_prog) {
                gl.deleteProgram(last_prog.program)
            }
            const prog = gl_compile_program(
                base_vs,
                line_fs_shaders[i].src,
                ["a_position"],
                [
                    "bg_color", "line_color",
                    "resolution", "prev_texture",
                    "zoom", "enable_range", "continuous_range"
                ]
            )
            gl.useProgram(prog.program)
            gl_set_vaa([
                -1,-1,0,1,
                1,-1,0,1,
                -1,1,0,1,
                -1,1,0,1,
                1,-1,0,1,
                1,1,0,1
            ], prog.attributes["a_position"])
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
            if (parseInt(i, 10) === f_len - 1) {
                last_render_target = null
            } else {
                last_render_target = gl_init_render_target(gl.canvas.width, gl.canvas.height)
            }
            gl.uniform2fv(prog.uniforms["resolution"], [gl.canvas.width, gl.canvas.height])
            gl.uniform3fv(prog.uniforms["bg_color"], variables.bg_color)
            gl.uniform3fv(prog.uniforms["line_color"], line_fs_shaders[i].color)
            gl.uniform1f(prog.uniforms["zoom"], variables.zoom)
            if (prog.uniforms["enable_range"]) {
                if (line_fs_shaders[i].continuous_range) {
                    gl.uniform1i(prog.uniforms["enable_range"], 1)
                    gl.uniform2fv(prog.uniforms["continuous_range"], line_fs_shaders[i].continuous_range)
                } else {
                    gl.uniform1i(prog.uniforms["enable_range"], 0)
                }
            }
            if (last_render_target != null) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, last_render_target.fbo)
            } else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            }
            gl_set_texture(last_texture, prog.uniforms["prev_texture"], 0)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
            if (last_render_target != null) {
                last_texture = last_render_target.texture
            }
            last_prog = prog
        } catch (e) {
            console.error(e)
            if (last_prog) {
                // still render if there are some errors
                gl.bindFramebuffer(gl.FRAMEBUFFER, null)
                gl_set_texture(last_texture, last_prog.uniforms["prev_texture"], 0)
                gl.drawArrays(gl.TRIANGLES, 0, 6)
            }
        }
    }
}

function render() {
    if (!running) {
        return
    }
    update_global_vars()
    //
    if (variables.debug) {
        show_debug()
    }
    //
    gl_clear(variables.bg_color)
    //
    gl_create_vao()
    //
    render_line_fs_shaders(line_fs_shaders())
    if (!variables.static_render) {
        requestAnimationFrame(render)
    }
}

function render_loop() {
    if (!variables.static_render) {
        time = Date.now()
    }
    render()
}

// ----------------------------------------------------------------
function add_example() {
    ui_add_function_row(
        formula = `
        float y = 0.;
        int N = 5;
        for (int i = 1; i <= N; i++) {
            float fi = float(i);
            float shift = float(N) - fi;
            float freq = sqrt(fi);
            float scale = sqrt(fi);
            y += scale * sin(shift + freq * x);
        }
        return y;
        `
    )
}
// ----------------------------------------------------------------

function main() {
    setup()
    add_example()
    update_and_render_functions()
    render_loop()
}

main()