import { BufferAttribute, BufferGeometry } from 'three';

export interface MeshRegion {
  axis: 0 | 1 | 2;
  boundary: number;
  side: 'lower' | 'upper';
}

/** Select whole STL triangles at an existing seam without moving or cutting vertices. */
export function selectMeshRegion(source: BufferGeometry, region: MeshRegion): BufferGeometry {
  const position = source.getAttribute('position');
  if (source.index || position.count % 3 !== 0) throw new Error('Mesh regions require non-indexed STL triangles.');
  const tolerance = 1e-6;
  const vertices: number[] = [];
  for (let start = 0; start < position.count; start += 3) {
    const coordinates = [0, 1, 2].map(offset => position.getComponent(start + offset, region.axis));
    const low = Math.min(...coordinates), high = Math.max(...coordinates);
    if (low < region.boundary - tolerance && high > region.boundary + tolerance) {
      throw new Error('The mesh region boundary crosses a triangle; review the CAD seam.');
    }
    // Coplanar triangles belong to the upper region, keeping the partition disjoint.
    const upper = low >= region.boundary - tolerance;
    if (upper === (region.side === 'upper')) vertices.push(start, start + 1, start + 2);
  }
  if (!vertices.length) throw new Error('The mesh region is empty; review the CAD seam.');
  const result = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = new Float32Array(vertices.length * attribute.itemSize);
    vertices.forEach((vertex, index) => {
      for (let component = 0; component < attribute.itemSize; component++) {
        values[index * attribute.itemSize + component] = attribute.getComponent(vertex, component);
      }
    });
    result.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
  }
  return result;
}
