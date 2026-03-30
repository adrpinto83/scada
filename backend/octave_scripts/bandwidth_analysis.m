%% bandwidth_analysis.m — Análisis de ancho de banda (OBJ-4)

function bandwidth_analysis()
    raw = fgetl(stdin);
    try
        json_str = char(base64_decode(raw));
        data = jsondecode(json_str);
        
        tau = data.tau;
        Np = data.Np;
        Nc = data.Nc;
        dt = data.dt;
        
        % BW_OL = 1 / tau_max
        tau_max = max(tau(:));
        bw_ol = 1.0 / tau_max;
        
        % BW_CL estimado
        settling_time = 2 * Nc * dt;
        bw_cl = 1.0 / settling_time;
        
        ratio = bw_cl / bw_ol;
        compliant = (ratio >= 0.8) && (ratio <= 1.25);
        
        result.bw_ol = bw_ol;
        result.bw_cl = bw_cl;
        result.ratio = ratio;
        result.compliant = compliant;
        result.status = 'ok';
        result.msg = '';
    catch e
        result.status = 'error';
        result.msg = e.message;
    end
    disp(jsonencode(result));
end

bandwidth_analysis();
