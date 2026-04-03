%% scaling_analysis.m — Análisis de escalado óptimo CondMin en Octave
%
% Minimiza cond(L @ G0 @ R) mediante SQP donde L, R son diagonales positivas.
% Entrada: JSON-base64 con {"G0": [[...], [...], [...]]}
% Salida: JSON con L_diag, R_diag, κ_original, κ_escalado, SVDs
%
% Protocolo: stdin=base64(json), stdout=json
%
% Requisitos: GNU Octave 7.0+ (sqp en core, sin pkg load optim)
%

function scaling_analysis()
    try
        % Leer desde stdin
        raw = fgetl(stdin);
        if ~ischar(raw) || isempty(raw)
            error('No se recibió entrada por stdin');
        end

        % Decodificar base64 → JSON string
        json_str = char(base64_decode(raw));

        % Parsear JSON
        data = jsondecode(json_str);
        G0 = data.G0;  % Matriz 3x3

        [m, n] = size(G0);

        % Valores singulares originales
        sv_orig = svd(G0);
        if min(sv_orig) < 1e-12
            error('G0 singular: min(svd) < 1e-12');
        end
        kappa_orig = max(sv_orig) / min(sv_orig);

        % Función objetivo: cond(L @ G0 @ R)
        % x(1:m) = log(diag(L)), x(m+1:m+n) = log(diag(R))
        % Espacio logarítmico → positividad garantizada sin restricciones

        function val = funobj(x)
            L = diag(exp(x(1:m)));
            R = diag(exp(x(m+1:end)));
            sv = svd(L * G0 * R);
            if min(sv) < 1e-12
                val = 1e12;  % Penalidad por singularidad
            else
                val = max(sv) / min(sv);  % Número de condición
            end
        end

        % Optimización SQP (sin restricciones explicitas en espacio log)
        X0 = zeros(1, m + n);
        options = optimoptions('sqp', 'MaxIterations', 500, 'FunctionTolerance', 1e-8);
        [Xt, obj, info] = sqp(X0, @funobj, [], [], [], [], [], [], [], options);

        % Transformar de vuelta del espacio log
        L_diag = exp(Xt(1:m))';
        R_diag = exp(Xt(m+1:end))';
        L = diag(L_diag);
        R = diag(R_diag);

        % Matriz escalada y su SVD
        G0_scaled = L * G0 * R;
        sv_scaled = svd(G0_scaled);
        kappa_scaled = max(sv_scaled) / min(sv_scaled);

        % Armar resultado
        result = struct();
        result.status = 'ok';
        result.msg = '';
        result.sv_original = sv_orig';
        result.kappa_original = kappa_orig;
        result.L_diag = L_diag;
        result.R_diag = R_diag;
        result.sv_scaled = sv_scaled';
        result.kappa_scaled = kappa_scaled;
        result.G0_scaled = G0_scaled;
        result.success = true;
        result.sqp_info = info;

        % Retornar como JSON en stdout
        disp(jsonencode(result));

    catch e
        result = struct();
        result.status = 'error';
        result.msg = e.message;
        result.identifier = e.identifier;
        disp(jsonencode(result));
    end
end

% Ejecutar función
scaling_analysis();
