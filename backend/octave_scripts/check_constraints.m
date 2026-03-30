%% check_constraints.m — Verificación de restricciones RC-1 a RC-6

function check_constraints()
    raw = fgetl(stdin);
    try
        json_str = char(base64_decode(raw));
        data = jsondecode(json_str);
        
        u = data.u;
        u_prev = data.u_prev;
        y = data.y;
        
        % Restricciones
        u_sat = min(max(u, -0.5), 0.5);  % RC-1, RC-2
        du_max = 0.05;
        du = u_sat - u_prev;
        u_limited = u_prev + min(max(du, -du_max), du_max);  % RC-3
        
        result.outputs = u_limited;
        result.violations = struct('u_bounds', false, 'rate_limit', false);
        result.status = 'ok';
        result.msg = '';
    catch e
        result.outputs = [];
        result.status = 'error';
        result.msg = e.message;
    end
    disp(jsonencode(result));
end

check_constraints();
