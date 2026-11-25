BEGIN;

INSERT INTO public.patients (id, nombre_completo, fecha_nacimiento, lugar_nacimiento, sexo, telefono, curp, correo)
VALUES
    ('9bd156d0-2e70-5178-a11c-4f515162669c', 'Teresa Ramírez Pérez', '1950-06-12', 'Aguascalientes', 'M',
        '+520000000001', 'DEMO00000000000001', 'teresa@example.test'),
    ('08dc20ad-d36d-5c1b-bafe-200a687ab88c', 'Enrique Salazar Navarro', '1989-03-19', 'Baja California', 'H',
        '+520000000002', 'DEMO00000000000002', 'paciente0002@example.test'),
    ('82aec1cf-4f21-5470-8242-72bd390324da', 'Daniela Ramírez Martínez', '2003-10-02', 'Baja California Sur', 'M',
        '+520000000003', 'DEMO00000000000003', 'paciente0003@example.test')
ON CONFLICT (curp) DO UPDATE
SET correo = EXCLUDED.correo
WHERE nullif(btrim(patients.correo), '') IS NULL;

COMMIT;
