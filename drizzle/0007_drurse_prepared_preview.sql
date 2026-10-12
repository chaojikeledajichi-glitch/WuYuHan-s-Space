-- Attach the supplied drurse-detail detail images to the newly added visual project.
-- Preserve its cover and all other portfolio fields.
UPDATE portfolio
SET data = json_set(data,
  '$.projects[' || (SELECT project.key FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-2'
      AND json_extract(project.value, '$.cover') = '/media/photo/55cf1288-7826-4b59-b2b4-3cd8416d448e.webp') || '].detailImages',
  json('[{"url":"/media/photo/d4277226-af1c-4301-a000-d085a1ed2a50.webp","width":1600,"height":2250},{"url":"/media/photo/94e25420-f992-4356-bb6c-594df89b2514.webp","width":1600,"height":900},{"url":"/media/photo/32a4fc75-5193-4da9-9114-adcd00fb8b73.webp","width":1600,"height":900},{"url":"/media/photo/297aff66-11fc-4a01-9e9c-c1ec1a4b3c09.webp","width":1600,"height":900},{"url":"/media/photo/b318d425-ce16-48c3-90d7-df6514c2e5af.webp","width":1600,"height":900},{"url":"/media/photo/5a92940b-ab1d-4efa-b98e-cc0987ea8e12.webp","width":1600,"height":900},{"url":"/media/photo/caa3131f-6c39-414a-87c0-11a3a0e7df7d.webp","width":1600,"height":2400},{"url":"/media/photo/5b01b308-6b3b-4598-9265-8794ff1ad121.webp","width":1600,"height":1200},{"url":"/media/photo/1a1dcb7f-5308-492c-908e-ba927c0d6be3.webp","width":1600,"height":900},{"url":"/media/photo/8c90d80c-ac99-4a3a-99f4-1fa8e3fde85e.webp","width":1600,"height":2400},{"url":"/media/photo/193b7cce-0ed8-4488-94c7-0b9d28c36e4c.webp","width":1600,"height":2100}]')),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND (SELECT COUNT(*) FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-2'
      AND json_extract(project.value, '$.cover') = '/media/photo/55cf1288-7826-4b59-b2b4-3cd8416d448e.webp') = 1;
