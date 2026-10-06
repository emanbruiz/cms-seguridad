export function validId(req, res, next) {
  if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  next();
}

export function validSlug(req, res, next) {
  const slug = String(req.params.slug);
  if (slug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido' });
  }
  next();
}