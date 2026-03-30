%% apply_uncertainty.m — Aplica incertidumbre paramétrica

function apply_uncertainty()
    raw = fgetl(stdin);
    try
        json_str = char(base64_decode(raw));
        data = jsondecode(json_str);
        
        K_nom = data.K_nom;
        dK = data.dK;
        eps = data.eps;
        
        % K_real = K_nom + dK * eps'
        K_real = K_nom + dK .* eps;
        
        result.outputs = K_real;
        result.status = 'ok';
        result.msg = '';
    catch e
        result.outputs = [];
        result.status = 'error';
        result.msg = e.message;
    end
    disp(jsonencode(result));
end

apply_uncertainty();
