// Mensajes de validación en español. Los mensajes propios de los esquemas se respetan;
// los genéricos de Zod (en inglés) se traducen sin revelar detalles internos.
function mensaje(issue) {
  if (issue.message && !/^(invalid|too |unrecognized|expected)/i.test(issue.message)) return issue.message;

  switch (issue.code) {
    case 'invalid_type':
      if (issue.path.length === 0) return 'Falta el cuerpo de la petición';
      return /received undefined/.test(issue.message) ? 'Campo obligatorio' : 'Tipo de dato inválido';
    case 'too_small':
      return issue.origin === 'string' ? `Debe tener al menos ${issue.minimum} caracteres` : 'Valor demasiado pequeño';
    case 'too_big':
      return issue.origin === 'string' ? `Debe tener como máximo ${issue.maximum} caracteres` : 'Valor demasiado grande';
    case 'invalid_format':
      return issue.format === 'email' ? 'Correo inválido' : 'Formato inválido';
    case 'unrecognized_keys':
      return `Campos no permitidos: ${issue.keys.join(', ')}`;
    case 'invalid_value':
      return 'Valor no permitido';
    default:
      return 'Valor inválido';
  }
}

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: mensaje(i),
      })),
    });
  }
  req.body = result.data;
  next();
};
