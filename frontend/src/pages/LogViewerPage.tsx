import { useQuery } from '@tanstack/react-query'
import FileUploadPanel from '../components/petrophysics/FileUploadPanel'
import { useStore } from '../store'
import { curvesApi, filesApi } from '../services/api'
import StraightBar from '../components/petrophysics/StraightBar'

export default function LogViewerPage() {
  const activeWell = useStore((state) => state.activeWell)

  const filesQuery = useQuery({
    queryKey: ['files', activeWell?.id],
    queryFn: () => filesApi.list(activeWell!.id).then((res) => res.data),
    enabled: !!activeWell,
  })

  const curvesQuery = useQuery({
    queryKey: ['curves', activeWell?.id],
    queryFn: () => curvesApi.list(activeWell!.id).then((res) => res.data),
    enabled: !!activeWell,
  })

  const files = filesQuery.data || []
  const curves = curvesQuery.data || []
  const latestLas = files.find((file: any) => file.file_type === 'LAS')

  if (!activeWell) {
    return (
      <div style={{ padding: 24, minHeight: '100%', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Select a well first, then upload a LAS file.
      </div>
    )
  }

  return (
    <div style={{ padding: 24, minHeight: '100%', display: 'grid', gap: 24 }}>
      <div style={{ padding: 28, borderRadius: 22, background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: '#2563EB', fontWeight: 700, textTransform: 'uppercase' }}>Upload LAS</div>
        <h1 style={{ margin: '10px 0 8px', color: '#0F172A' }}>Load LAS File And Well Details</h1>
        <p style={{ margin: 0, color: '#64748B' }}>
          Upload a LAS file here. Drake AI parses the header, stores the curves, and uses those logs for visualization, AI prediction, and uncertainty.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '360px 1fr' }}>
        <div style={{ height: 340, padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <FileUploadPanel />
        </div>
          <StraightBar />

        <div style={{ padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>Well Details From Uploaded LAS</div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              ['Well Name', activeWell.name],
              ['API / UWI', activeWell.api_number || 'N/A'],
              ['Operator', activeWell.operator || 'N/A'],
              ['Field', activeWell.field || 'N/A'],
              ['County', activeWell.county || 'N/A'],
              ['State', activeWell.state || 'N/A'],
              ['Top Depth', activeWell.top_depth ? `${activeWell.top_depth.toLocaleString()} ${activeWell.depth_uom || 'ft'}` : 'N/A'],
              ['Base Depth', activeWell.base_depth ? `${activeWell.base_depth.toLocaleString()} ${activeWell.depth_uom || 'ft'}` : 'N/A'],
              ['Total Depth', activeWell.total_depth ? `${activeWell.total_depth.toLocaleString()} ${activeWell.depth_uom || 'ft'}` : 'N/A'],
              ['KB Elevation', activeWell.kb_elevation ? `${activeWell.kb_elevation.toLocaleString()} ft` : 'N/A'],
              ['LAS Curves', curves.length],
              ['Latest LAS', latestLas?.filename || 'No LAS uploaded'],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: 16, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginTop: 5 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Uploaded LAS Files History</div>
        {files.length ? (
          <div style={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  {['File Name', 'Type', 'Size MB', 'Curves', 'Depth Start', 'Depth End', 'Processed', 'Uploaded'].map((head) => (
                    <th key={head} style={{ textAlign: 'left', padding: '12px 14px', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file: any, index: number) => (
                  <tr key={file.id} style={{ background: index % 2 ? '#FFFFFF' : '#F8FAFC' }}>
                    <td style={{ padding: '11px 14px', color: '#0F172A', fontWeight: 800 }}>{file.filename}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.file_type}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.file_size_mb}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.curve_count}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.depth_start ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.depth_end ?? '-'}</td>
                    <td style={{ padding: '11px 14px', color: file.is_processed ? '#15803D' : '#B91C1C', fontWeight: 800 }}>{file.is_processed ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '11px 14px', color: '#0F172A' }}>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748B' }}>No LAS upload history yet.</p>
        )}
      </div>

      <div style={{ padding: 22, borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Parsed LAS Curves</div>
        {curves.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {curves.map((curve: any) => (
              <span key={curve.id} style={{ padding: '8px 12px', borderRadius: 999, background: '#FCD3D3', color: '#9B1B1B', border: '1px solid #FCA5A5', fontSize: 12, fontWeight: 800 }}>
                {curve.mnemonic}{curve.unit ? ` (${curve.unit})` : ''}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748B' }}>No curves parsed yet. Upload a LAS file to begin.</p>
        )}
      </div>
    </div>
  )
}
