-- Attach the requested preview only to the existing first project/PDF.
-- Preserve every other field and protect previews saved concurrently.
UPDATE portfolio
SET data = json_set(data, '$.projects[0].detailImages', json('[{"url":"/media/photo/d41996a5-a25d-447b-807a-537d08865752.webp","width":1600,"height":1802},{"url":"/media/photo/03a64faa-6e00-48d1-9ae0-8c6d2f318c07.webp","width":1600,"height":900},{"url":"/media/photo/d1267146-6ef2-4a7b-984e-6429253edcae.webp","width":1600,"height":1800},{"url":"/media/photo/976f6913-667e-490d-9b9d-d522068c50f2.webp","width":1600,"height":1800},{"url":"/media/photo/913c7f87-bed6-4fdf-83f7-bf516b6a42ae.webp","width":1600,"height":2400},{"url":"/media/photo/2878f48c-6963-4361-bdbe-dbffa3b7194a.webp","width":1600,"height":300},{"url":"/media/photo/9cce487f-eff0-43b1-a7ad-0d82f811c5be.webp","width":1600,"height":2400},{"url":"/media/photo/9679e0f4-033b-4289-9e0b-7370e7331842.webp","width":1600,"height":1200},{"url":"/media/photo/ab9399e8-c10d-4856-8c34-dc06ab03220e.webp","width":1600,"height":2400},{"url":"/media/photo/2ffaaae3-6dee-432c-91ff-994a32ea918d.webp","width":1600,"height":1200},{"url":"/media/photo/d2e80abb-dac3-4611-956c-28a25f86f86c.webp","width":1600,"height":2250},{"url":"/media/photo/5f019da3-0626-4365-8390-1656a3ba5a60.webp","width":1600,"height":2400},{"url":"/media/photo/aea1b2fc-9280-49e1-849c-56b6af0ed4a0.webp","width":1600,"height":2400},{"url":"/media/photo/8f38c178-0e68-4a36-90ba-1adf1145e3e1.webp","width":1600,"height":150},{"url":"/media/photo/b4fe054f-5c56-41f2-a310-6125fac79979.webp","width":1600,"height":2250},{"url":"/media/photo/a79b5a17-9e9b-4b32-9566-552e6e1d3fde.webp","width":1600,"height":900}]')),
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND json_extract(data, '$.projects[0].id') = 'project-0'
  AND json_extract(data, '$.projects[0].categoryId') = 'category-1'
  AND json_extract(data, '$.projects[0].pdf.url') = '/media/projects/deac2eed-dbfe-493a-ad8d-1cba962eb17d.pdf'
  AND COALESCE(json_array_length(json_extract(data, '$.projects[0].detailImages')), 0) = 0;
