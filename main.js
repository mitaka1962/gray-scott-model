$(function() {
    let update_flag = true;
    let update_step = 8;
    const presets = [
        { feed: 0.022, kill: 0.051 },   // stripe                                  
        { feed: 0.035, kill: 0.065 },   // spots
        { feed: 0.012, kill: 0.050 },   // wandering bubbles
        { feed: 0.025, kill: 0.050 },   // waves
        { feed: 0.040, kill: 0.060 },   // amorphous
        { feed: 0.028, kill: 0.054 },   // bumps
        { feed: 0.025, kill: 0.060 },   // waving spots
        { feed: 0.030, kill: 0.060 },   // snapping strings
        { feed: 0.011, kill: 0.046 }    // balloons
    ];
    const default_preset = 0;
    const params = {
        'width': 380,
        'height': 380,
        'dx': 0.01,
        'dt': 1,
        'Du': 2e-5,
        'Dv': 1e-5,
        'feed': presets[default_preset].feed,
        'kill': presets[default_preset].kill,
        'render_mode': 0,           // 0: 3D, 1: 2D
        'render_target': 0,         // 0: draw u, 1: draw v
        'render_color': 0,          // 0: sky, 1: milky, 2: poison, 3: greyscale
        'boundary_condition': 0,    // 0: periodic, 1: dirichlet, 2: neumann
    };

    const gl = document.getElementById('canvas').getContext('webgl2');
    if (!gl) {
        alert('Unable to initialize WebGL2. Make sure your browser or machine supports it.');
        return;
    }
    const visualizer = new GrayScottVisualizer(gl, params);

    // initialize u, v
    const createInitTexture = function() {
        const SQUARE_SIZE = 40;
        const x_start = Math.floor(params.width / 2) - Math.floor(SQUARE_SIZE / 2);
        const y_start = Math.floor(params.height / 2) - Math.floor(SQUARE_SIZE / 2);
        const x_end = x_start + SQUARE_SIZE;
        const y_end = y_start + SQUARE_SIZE;
    
        let uvTexture = [];
        for (let i = 0; i < params.height; i++) {
            for (let j = 0; j < params.width; j++) {
                let u, v;
                if ((i >= y_start) && (i < y_end) && (j >= x_start) && (j < x_end)) {
                    u = 0.5 + Math.random() * 0.1;
                    v = 0.25 + Math.random() * 0.1;
                } else {
                    u = 1.0;
                    v = 0.0;
                }
                uvTexture.push(u, v);
            }
        }
    
        return new Float32Array(uvTexture);
    }

    const initUI = function() {
        $('#init_btn').button().click(function () {
            if (!update_flag) {
                update_step = 8;
                update_flag = true;
                $('#ctrl_btn').text('Pause');
            }
            visualizer.setTexture(createInitTexture());
        });
        $('#init_btn').text('Init');

        $('#ctrl_btn').button().click(function () {
            if (update_flag) {
                update_step = 0;
                update_flag = false;
                $('#ctrl_btn').text('Play');
            } else {
                update_step = 8;
                update_flag = true;
                $('#ctrl_btn').text('Pause');
            }
        });
        $('#ctrl_btn').text('Pause');

        $('#three_d_btn').checkboxradio({
            classes: {'ui-checkboxradio-label': 'ui-corner-left',
                      'ui-checkboxradio-icon': 'ui-corner-left'},
            icon: false,
        });
        $('#two_d_btn').checkboxradio({
            classes: {'ui-checkboxradio-label': 'ui-corner-right',
                      'ui-checkboxradio-icon': 'ui-corner-right'},
            icon: false,
        });

        $('#u_render_btn').checkboxradio({
            classes: {'ui-checkboxradio-label': 'ui-corner-left',
                      'ui-checkboxradio-icon': 'ui-corner-left'},
            icon: false,
        });
        $('#v_render_btn').checkboxradio({
            classes: {'ui-checkboxradio-label': 'ui-corner-right',
                      'ui-checkboxradio-icon': 'ui-corner-right'},
            icon: false,
        });
        $('input[name="uv_render"]').change(function (event) {
            params.render_target = event.target.value;
        })
        $('input[name="uv_render"][value=' + params.render_target + ']').attr('checked', true).change();

        $('#render_color_select').selectmenu({
            select: function (event, ui) {
                params.render_color = ui.item.value;
            },
        });
        $('#render_color_select').val(params.render_color);
        $('#render_color_select').selectmenu('refresh');

        $('#preset_select').selectmenu({
            select: function (event, ui) {
                $('#feed_slider').slider('value', presets[ui.item.value].feed);
                $('#kill_slider').slider('value', presets[ui.item.value].kill);
            },
        });
        $('#preset_select').val(default_preset);
        $('#preset_select').selectmenu('refresh');

        $('input[name="render"]').change(function (event) {
            const val = event.target.value
            params.render_mode = val;
            if (val == 0) {
                $('#render_color_select').selectmenu('enable');
            } else {
                $('#render_color_select').selectmenu('disable');
            }
        })
        $('input[name="render"][value=' + params.render_mode + ']').attr('checked', true).change();

        $('#feed_slider').slider({
            value: params.feed, min: 0.000, max: 0.050, step: 0.001,
            change: function (event, ui) {params.feed = ui.value;
                                          $('#feed_span').text(params.feed.toFixed(3));},
            slide: function (event, ui) {params.feed = ui.value;
                                         $('#feed_span').text(params.feed.toFixed(3));}
        });
        $('#feed_slider').slider('value', params.feed);

        $('#kill_slider').slider({
            value: params.kill, min: 0.040, max: 0.075, step: 0.001,
            change: function (event, ui) {params.kill = ui.value;
                                          $('#kill_span').text(params.kill.toFixed(3));},
            slide: function (event, ui) {params.kill = ui.value;
                                         $('#kill_span').text(params.kill.toFixed(3));}
        });
        $('#kill_slider').slider('value', params.kill);

        $('input[name="condition"]').checkboxradio({icon: false});
        $('input[name="condition"]').change(function (event) {
            params.boundary_condition = event.target.value;
        });
        $('input[name="condition"][value=' + params.boundary_condition +']').attr('checked', true).change();
    }

    initUI();
    visualizer.setTexture(createInitTexture())

    const render = function() {
        visualizer.draw(update_step);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
});
