"use client"
import { useEffect, useState } from 'react'
import { useFocusTick } from '@/lib/useFocusTick'
import Link from 'next/link'
import ActivityCard from '@/components/ActivityCard'
import { useBadgeAwardContext } from '@/contexts/BadgeAwardContext'
import { triggerBadgeCheck } from '@/lib/badgeChecker'

// Lazy-load Supabase on the client to avoid Edge runtime pulling Node builtins
const getSupabase = async () => (await import('@/lib/supabaseClient')).supabase

type Gym = { id: string; name: string; location: string | null; profile_photo: string | null }
type Climb = { id: string; name: string; grade: number | null; type: 'boulder' | 'top_rope' | 'lead'; location: string | null; setter: string | null; color: string | null; dyno: boolean | null; section_id: string | null; section?: { name: string } | null; community_grade?: number | null }
type Section = { id: string; name: string }
type Photo = { id: string; climb_id: string; image_base64: string | null; created_at?: string }

interface GymDetailClientProps {
  gymId: string
  initialGym: Gym | null
  initialClimbs: Climb[]
  initialSections: Section[]
  initialIsAdmin: boolean
  initialClaimed: boolean
  initialActivity: any[]
  currentUserId: string
  initialSentIds?: string[]
}

// Thumbnail cache utilities
const CACHE_KEY_PREFIX = 'climb-thumbnails-'
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCachedThumbnail(climbId: string): string | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${climbId}`)
    if (!cached) return null

    const { url, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${climbId}`)
      return null
    }
    return url
  } catch {
    return null
  }
}

function setCachedThumbnail(climbId: string, url: string): void {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${climbId}`, JSON.stringify({
      url,
      timestamp: Date.now()
    }))
  } catch {
    // Ignore cache errors (storage might be full)
  }
}

// Helper function for image compression - uses WebP for better performance
function compressToBase64(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      const { width, height } = img
      const ratio = Math.min(maxWidth / width, maxWidth / height)
      canvas.width = width * ratio
      canvas.height = height * ratio

      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Try WebP first (better compression), fallback to JPEG for compatibility
      let base64: string
      try {
        base64 = canvas.toDataURL('image/webp', quality)
        if (base64.startsWith('data:image/webp')) {
          resolve(base64.split(',')[1])
          return
        }
      } catch (e) {
        console.warn('WebP not supported, falling back to JPEG')
      }

      // Fallback to JPEG
      base64 = canvas.toDataURL('image/jpeg', quality)
      resolve(base64.split(',')[1])
    }

    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function GymDetailClient({
  gymId,
  initialGym,
  initialClimbs,
  initialSections,
  initialIsAdmin,
  initialClaimed,
  initialActivity,
  currentUserId,
  initialSentIds = []
}: GymDetailClientProps) {
  const gid = gymId
  const { awardMultipleBadges } = useBadgeAwardContext()
  const focusTick = useFocusTick(250)
  const [gym, setGym] = useState<Gym | null>(initialGym)
  const [climbs, setClimbs] = useState<Climb[]>(initialClimbs)
  const [allClimbs, setAllClimbs] = useState<Climb[]>([]) // Store all climbs when filtering
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
  const [claimed, setClaimed] = useState<boolean>(initialClaimed)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({})
  const [previews, setPreviews] = useState<Record<string, string | null>>({})
  const [sentClimbIds, setSentClimbIds] = useState<Set<string>>(new Set(initialSentIds))
  const [lightbox, setLightbox] = useState<{ climbId: string, idx: number, photos: Photo[] } | null>(null)
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [editing, setEditing] = useState<{ open: boolean, climb: Climb | null, form: any }>({ open: false, climb: null, form: null })
  const [activity, setActivity] = useState<any[]>(initialActivity)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityPage, setActivityPage] = useState(0)
  const [activityHasMore, setActivityHasMore] = useState(true)
  const [viewTab, setViewTab] = useState<'active'|'removed'>('active')
  const [climbsPage, setClimbsPage] = useState(0)
  const [climbsLoading, setClimbsLoading] = useState(false)
  const [climbsHasMore, setClimbsHasMore] = useState(false)
  const [gradeFilter, setGradeFilter] = useState<number | null>(null)
  const [colorFilter, setColorFilter] = useState<string | null>(null)
  const [showAddClimb, setShowAddClimb] = useState(false)
  const [showSections, setShowSections] = useState(false)
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)

  const CLIMBS_PAGE_SIZE = 6

  // Load photo counts and previews on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialClimbs.length > 0) {
        const ids = initialClimbs.map(c => c.id)
        loadPhotoCounts(ids)
        markUserSends(ids)
      }
      // Set pagination state
      setClimbsPage(0)
      setClimbsHasMore(initialClimbs.length >= CLIMBS_PAGE_SIZE)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // Revalidate on tab return without changing layout
  useEffect(() => {
    if (focusTick > 0) {
      refreshData()
    }
  }, [focusTick, gid])

  async function refreshData() {
    try {
      const supabase = await getSupabase()

      // Refresh admin status
      const { data: adminData } = await supabase.rpc('is_gym_admin', { gid })
      if (adminData !== null) setIsAdmin(Boolean(adminData))

      // Refresh claimed status
      const { data: admins } = await supabase.from('gym_admins').select('user_id').eq('gym_id', gid).limit(1)
      setClaimed((admins || []).length > 0)
    } catch (e) {
      console.error('Failed to refresh data:', e)
    }
  }

  async function loadPhotoCounts(climbIds: string[]) {
    console.log('[DEBUG] Loading photo counts for climbs:', climbIds)
    try {
      const supabase = await getSupabase()

      // First, check cache for thumbnails
      const previewMap: Record<string, string | null> = {}
      const climbsNeedingFetch: string[] = []

      for (const cid of climbIds) {
        const cached = getCachedThumbnail(cid)
        if (cached) {
          previewMap[cid] = cached
          console.log('[DEBUG] Using cached preview for climb', cid)
        } else {
          climbsNeedingFetch.push(cid)
        }
      }

      // Set cached previews immediately
      if (Object.keys(previewMap).length > 0) {
        setPreviews(prev => ({ ...prev, ...previewMap }))
      }

      // Get latest photo for each climb in a single query
      const { data: latestPhotos, error } = await supabase
        .from('climb_photos')
        .select('climb_id, image_base64, created_at')
        .in('climb_id', climbIds)
        .order('created_at', { ascending: false })

      console.log('[DEBUG] Photo query result:', { latestPhotos, error })

      const counts: Record<string, number> = {}
      const newPreviewMap: Record<string, string | null> = {}
      const seenClimbs = new Set<string>()

      // Process photos to get counts and first (latest) photo for each climb
      for (const photo of latestPhotos || []) {
        const cid = photo.climb_id as string
        counts[cid] = (counts[cid] || 0) + 1

        // Only set preview for the first (latest) photo we see for each climb
        if (!seenClimbs.has(cid)) {
          seenClimbs.add(cid)
          const b64 = photo.image_base64
          const url = b64 ? `data:image/*;base64,${b64}` : null

          // Only update if we don't have a cached version or it's different
          if (!previewMap[cid] && url) {
            newPreviewMap[cid] = url
            setCachedThumbnail(cid, url) // Cache the new thumbnail
            console.log('[DEBUG] Set and cached new preview for climb', cid)
          }
        }
      }

      console.log('[DEBUG] Final counts:', counts, 'new previews:', Object.keys(newPreviewMap))
      setPhotoCounts(counts)

      // Update previews with any new ones
      if (Object.keys(newPreviewMap).length > 0) {
        setPreviews(prev => ({ ...prev, ...newPreviewMap }))
      }

    } catch (e) {
      console.error('Failed to load photo counts:', e)
      // Fallback to individual preview loading
      console.log('[DEBUG] Falling back to individual fetch for', climbIds.length, 'climbs')
      const previewMap: Record<string, string | null> = {}
      setPhotoCounts({})
      setPreviews(previewMap)
      climbIds.forEach((cid: string) => fetchPreview(cid))
    }
  }

  // Fetch which of the given climbs this user has sent (flashed or sent)
  async function markUserSends(climbIds: string[]) {
    try {
      if (!currentUserId || climbIds.length === 0) return
      const supabase = await getSupabase()
      const { data, error } = await supabase
        .from('climb_logs')
        .select('climb_id, attempt_type')
        .eq('user_id', currentUserId)
        .in('climb_id', climbIds)
        .in('attempt_type', ['flashed','sent'])
      if (error) return
      const ids = new Set<string>([...sentClimbIds])
      for (const row of (data || []) as any[]) ids.add(String(row.climb_id))
      setSentClimbIds(ids)
    } catch {}
  }

  async function loadActivity(reset: boolean = true) {
    setActivityLoading(true)
    try {
      const supabase = await getSupabase()
      const pageSize = 6
      const page = reset ? 0 : (activityPage + 1)
      const { data, error } = await supabase.rpc('get_gym_activity', { gid, page_size: pageSize, page })
      if (error) {
        console.error('Activity query failed:', error)
      } else {
        const rows = (data as any[]) || []
        setActivity(prev => reset ? rows : [...prev, ...rows])
        setActivityPage(page)
        setActivityHasMore(rows.length === pageSize)
      }
    } catch (e) {
      console.error('Activity query exception:', e)
    } finally {
      setActivityLoading(false)
    }
  }

  async function loadMoreClimbs() {
    setClimbsLoading(true)

    // If we have filters active and all filtered climbs are loaded, paginate from allClimbs
    if ((gradeFilter || colorFilter) && allClimbs.length > 0) {
      const nextPageStart = (climbsPage + 1) * CLIMBS_PAGE_SIZE
      const nextPageEnd = nextPageStart + CLIMBS_PAGE_SIZE
      const nextPageClimbs = allClimbs.slice(nextPageStart, nextPageEnd)

      if (nextPageClimbs.length > 0) {
        setClimbs(prev => [...prev, ...nextPageClimbs])
        setClimbsPage(prev => prev + 1)
        setClimbsHasMore(allClimbs.length > nextPageEnd)

        // Load photo counts for new climbs
        const ids = nextPageClimbs.map(c => c.id)
        loadPhotoCounts(ids)
      } else {
        setClimbsHasMore(false)
      }
      setClimbsLoading(false)
      return
    }

    // Normal pagination for unfiltered results
    const supabase = await getSupabase()
    const pageSize = CLIMBS_PAGE_SIZE
    const offset = (climbsPage + 1) * pageSize
    const { data: newClimbs, error } = await supabase
      .from('climbs')
      .select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)')
      .eq('gym_id', gid)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (!error && newClimbs) {
      const normalized: Climb[] = newClimbs.map((x: any) => ({
        id: x.id,
        name: x.name,
        grade: x.grade,
        type: x.type,
        location: x.location,
        setter: x.setter,
        color: x.color,
        dyno: x.dyno,
        section_id: x.section_id,
        section: Array.isArray(x.section)
          ? (x.section[0] ? { name: String(x.section[0]?.name ?? '') } : null)
          : (x.section ? { name: String(x.section?.name ?? '') } : null)
      }))

      setClimbs(prev => [...prev, ...normalized])
      setClimbsPage(prev => prev + 1)
      setClimbsHasMore(normalized.length >= pageSize)

      // Load community ratings for new climbs
      const newIds = normalized.map(x => x.id)
      if (newIds.length) {
        try {
          const { data: ratings } = await supabase
            .from('community_ratings')
            .select('climb_id, rating')
            .in('climb_id', newIds)

          if (ratings) {
            const avgRatings: Record<string, number> = {}
            const ratingCounts: Record<string, number> = {}

            for (const r of ratings) {
              const cid = r.climb_id
              if (!avgRatings[cid]) {
                avgRatings[cid] = 0
                ratingCounts[cid] = 0
              }
              avgRatings[cid] += r.rating
              ratingCounts[cid] += 1
            }

            // Calculate averages and update new climbs
            for (const cid in avgRatings) {
              avgRatings[cid] = Math.round((avgRatings[cid] / ratingCounts[cid]) * 10) / 10
            }

            setClimbs(prev => prev.map(climb =>
              newIds.includes(climb.id)
                ? { ...climb, community_grade: avgRatings[climb.id] || null }
                : climb
            ))
          }
        } catch (e) {
          console.error('Failed to load community ratings for new climbs:', e)
        }
      }

      // Load previews for new climbs
      if (newIds.length) {
        const { data: photos } = await supabase
          .from('climb_photos')
          .select('id, climb_id, created_at')
          .in('climb_id', newIds)
          .order('created_at', { ascending: false })

        const newCounts: Record<string, number> = {}
        for (const p of photos || []) {
          const cid = (p as any).climb_id as string
          newCounts[cid] = (newCounts[cid] || 0) + 1
        }
        setPhotoCounts(prev => ({ ...prev, ...newCounts }))

        // Load previews for new climbs
        newIds.forEach(cid => fetchPreview(cid))
        try { await markUserSends(newIds) } catch {}
      }
    }
    setClimbsLoading(false)
  }

  async function fetchFilteredClimbs(grade: number | null, color: string | null) {
    setClimbsLoading(true)
    const supabase = await getSupabase()

    let query = supabase
      .from('climbs')
      .select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)')
      .eq('gym_id', gid)
      .order('created_at', { ascending: false })

    if (grade) {
      query = query.eq('grade', grade)
    }
    if (color) {
      query = query.eq('color', color)
    }

    const { data: filteredClimbs, error } = await query

    if (!error && filteredClimbs) {
      const normalized: Climb[] = filteredClimbs.map((x: any) => ({
        id: x.id,
        name: x.name,
        grade: x.grade,
        type: x.type,
        location: x.location,
        setter: x.setter,
        color: x.color,
        dyno: x.dyno,
        section_id: x.section_id,
        section: Array.isArray(x.section)
          ? (x.section[0] ? { name: String(x.section[0]?.name ?? '') } : null)
          : (x.section ? { name: String(x.section?.name ?? '') } : null)
      }))

      // Store all filtered climbs and display first page
      setAllClimbs(normalized)
      setClimbs(normalized.slice(0, CLIMBS_PAGE_SIZE))
      setClimbsPage(0)
      setClimbsHasMore(normalized.length > CLIMBS_PAGE_SIZE)

      // Load photo counts and sent markers for the first page of filtered climbs
      if (normalized.length > 0) {
        const ids = normalized.map(c => c.id)
        const firstPage = ids.slice(0, CLIMBS_PAGE_SIZE)
        loadPhotoCounts(firstPage)
        try { await markUserSends(firstPage) } catch {}
      }
    }
    setClimbsLoading(false)
  }

  const [form, setForm] = useState({ name: '', type: 'boulder' as 'boulder' | 'top_rope' | 'lead', grade: 5, location: '', setter: '', color: 'blue', dyno: false, section_id: '', active_status: true })
  const canCreate = isAdmin && !loading

  async function createClimb(e: React.FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    const selSection = sections.find(s => s.id === form.section_id)
    const payload = {
      gym_id: gid,
      name: form.name.trim(),
      grade: form.grade,
      type: form.type,
      location: selSection?.name || form.location || null,
      setter: form.setter || null,
      color: form.color || null,
      dyno: form.dyno,
      section_id: form.section_id || null,
      active_status: form.active_status
    }
    const supabase = await getSupabase()
    const { error } = await supabase.from('climbs').insert(payload)
    if (error) {
      alert(error.message)
      return
    }
    setForm({ name: '', type: 'boulder', grade: 5, location: '', setter: '', color: 'blue', dyno: false, section_id: '', active_status: true })
    // Reload first page of climbs
    const { data } = await supabase.from('climbs').select('id,name,grade,type,location,setter,color,dyno,section_id,active_status,section:gym_sections(name)').eq('gym_id', gid).order('created_at', { ascending: false }).limit(12)
    const normalized: Climb[] = ((data || []) as any[]).map((x: any) => ({
      id: x.id,
      name: x.name,
      grade: x.grade,
      type: x.type,
      location: x.location,
      setter: x.setter,
      color: x.color,
      dyno: x.dyno,
      section_id: x.section_id,
      active_status: x.active_status,
      section: Array.isArray(x.section)
        ? (x.section[0] ? { name: String(x.section[0]?.name ?? '') } : null)
        : (x.section ? { name: String(x.section?.name ?? '') } : null)
    }))
    setClimbs(normalized)
    setClimbsPage(0)
    setClimbsHasMore(normalized.length >= CLIMBS_PAGE_SIZE)
  }

  async function claimAdmin() {
    setClaiming(true)
    const supabase = await getSupabase()
    const { data, error } = await supabase.rpc('claim_gym_admin', { gid })
    setClaiming(false)
    if (error) {
      alert(error.message)
      return
    }
    if (data) setIsAdmin(true)
  }

  async function deleteClimb(id: string) {
    if (!isAdmin) return
    if (!confirm('Delete this climb? This cannot be undone.')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('climbs').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setClimbs(prev => prev.filter(c => c.id !== id))
  }

  function addPhoto(climbId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const supabase = await getSupabase()
        const base64 = await compressToBase64(file, 1280, 0.8)
        const { data, error } = await supabase.from('climb_photos').insert({ climb_id: climbId, image_base64: base64 }).select('id, climb_id, image_base64, created_at').single()
        if (error) alert(error.message)
        else {
          alert('Photo added')
          const newPreview = 'data:image/*;base64,' + (data as any).image_base64
          setPhotoCounts(pc => ({ ...pc, [climbId]: (pc[climbId] || 0) + 1 }))
          setPreviews(prev => ({ ...prev, [climbId]: newPreview }))
          // Update cache with new thumbnail
          setCachedThumbnail(climbId, newPreview)
        }
      } catch (e: any) {
        alert(e?.message || 'Failed to add photo')
      }
    }
    input.click()
  }

  function uploadProfilePhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setProfilePhotoUploading(true)
      try {
        const supabase = await getSupabase()
        const base64 = await compressToBase64(file, 1280, 0.8)
        const { error } = await supabase
          .from('gyms')
          .update({ profile_photo: base64 })
          .eq('id', gid)

        if (error) {
          alert(error.message)
        } else {
          alert('Profile photo updated')
          setGym(prev => prev ? { ...prev, profile_photo: base64 } : null)
        }
      } catch (e: any) {
        alert(e?.message || 'Failed to upload profile photo')
      } finally {
        setProfilePhotoUploading(false)
      }
    }
    input.click()
  }

  async function fetchPreview(climbId: string) {
    // Check cache first
    const cached = getCachedThumbnail(climbId)
    if (cached) {
      setPreviews(prev => ({ ...prev, [climbId]: cached }))
      return
    }

    const supabase = await getSupabase()
    const { data } = await supabase
      .from('climb_photos')
      .select('image_base64, created_at')
      .eq('climb_id', climbId)
      .order('created_at', { ascending: false })
      .limit(1)
    const b64 = data && (data[0] as any)?.image_base64
    const preview = b64 ? `data:image/*;base64,${b64}` : null

    // Cache the result
    if (preview) {
      setCachedThumbnail(climbId, preview)
    }

    setPreviews(prev => ({ ...prev, [climbId]: preview }))
  }

  async function deletePhoto(photoId: string, climbId: string) {
    if (!isAdmin) return
    if (!confirm('Delete this photo?')) return
    const supabase = await getSupabase()
    const { error } = await supabase.from('climb_photos').delete().eq('id', photoId)
    if (error) { alert(error.message); return }
    setPhotoCounts(pc => ({ ...pc, [climbId]: Math.max(0, (pc[climbId] || 1) - 1) }))
    // Clear cache and fetch new preview
    try { localStorage.removeItem(`${CACHE_KEY_PREFIX}${climbId}`) } catch {}
    fetchPreview(climbId).catch(() => {})
    if (lightbox && lightbox.climbId === climbId) {
      setLightbox({ ...lightbox, photos: lightbox.photos.filter(p => p.id !== photoId) })
    }
  }

  async function quickLog(climbId: string, defaults?: { attempts?: number, rating?: number, notes?: string, grade?: number }) {
    const supabase = await getSupabase()
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) { alert('Please sign in'); return }
    const { error: logErr } = await supabase.from('climb_logs').insert({
      user_id: uid,
      climb_id: climbId,
      attempt_type: 'sent',
      attempts: defaults?.attempts ?? 1,
      personal_rating: (defaults?.rating as any) ?? 3,
      notes: defaults?.notes || null
    })
    if (logErr) { alert(logErr.message); return }
    if (typeof defaults?.grade === 'number') {
      await supabase.from('community_ratings').upsert({ user_id: uid, climb_id: climbId, rating: defaults.grade }, { onConflict: 'user_id,climb_id' })
    }

    // Check for new badges after successful climb log
    await triggerBadgeCheck(uid, awardMultipleBadges)

    loadActivity().catch(() => {})
  }

  async function updateClimb(e: React.FormEvent) {
    e.preventDefault()
    if (!editing.climb || !isAdmin) return

    const supabase = await getSupabase()
    const updates = {
      name: editing.form.name.trim(),
      grade: editing.form.grade,
      type: editing.form.type,
      location: editing.form.location || null,
      setter: editing.form.setter || null,
      color: editing.form.color || null,
      dyno: editing.form.dyno,
      section_id: editing.form.section_id || null,
      active_status: editing.form.active_status
    }

    const { error } = await supabase.from('climbs').update(updates).eq('id', editing.climb.id)
    if (error) {
      alert(error.message)
      return
    }

    // Update local state
    setClimbs(prev => prev.map(c =>
      c.id === editing.climb!.id
        ? { ...c, ...updates, section: editing.form.section_id ? sections.find(s => s.id === editing.form.section_id) : null }
        : c
    ))

    setEditing({ open: false, climb: null, form: null })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/gym" className="text-sm text-base-subtext">← All Gyms</Link>
      </div>
      {loading && <div className="card text-base-subtext">Loading…</div>}
      {error && <div className="card text-red-400">{error}</div>}
      {gym && (
        <div className="card">
          <div className="flex items-start gap-4">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              {gym.profile_photo ? (
                <img
                  src={`data:image/*;base64,${gym.profile_photo}`}
                  alt={`${gym.name} profile`}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                  <span className="text-2xl text-base-subtext">🏔️</span>
                </div>
              )}
              {isAdmin && (
                <button
                  className="mt-2 text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1"
                  onClick={uploadProfilePhoto}
                  disabled={profilePhotoUploading}
                >
                  {profilePhotoUploading ? 'Uploading...' : 'Change Photo'}
                </button>
              )}
            </div>

            {/* Gym Info */}
            <div className="flex-1">
              <h1 className="text-xl font-bold">{gym.name}</h1>
              {gym.location && <div className="text-sm text-base-subtext">{gym.location}</div>}
              {!isAdmin && !claimed && (
                <div className="mt-3">
                  <button className="btn-primary" onClick={claimAdmin} disabled={claiming}>
                    {claiming ? 'Claiming…' : 'Claim Admin (if unclaimed)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Climbs</h2>
          <div className="ml-auto flex gap-2 text-sm">
            <button className={`px-3 py-1 rounded ${viewTab==='active'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setViewTab('active')}>Active</button>
            <button className={`px-3 py-1 rounded ${viewTab==='removed'?'bg-neon-purple text-white':'bg-white/10'}`} onClick={() => setViewTab('removed')}>Removed</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-base-subtext">Filters:</span>
          <select
            className="input px-2 py-1 text-sm"
            value={gradeFilter || ''}
            onChange={e => {
              const newGrade = e.target.value ? Number(e.target.value) : null
              setGradeFilter(newGrade)
              if (newGrade || colorFilter) {
                fetchFilteredClimbs(newGrade, colorFilter)
              } else {
                // Reset to original pagination
                setClimbs(initialClimbs)
                setAllClimbs([])
                setClimbsPage(0)
                setClimbsHasMore(initialClimbs.length >= CLIMBS_PAGE_SIZE)
              }
            }}
          >
            <option value="">All Grades</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(grade => (
              <option key={grade} value={grade}>Grade {grade}</option>
            ))}
          </select>
          <select
            className="input px-2 py-1 text-sm"
            value={colorFilter || ''}
            onChange={e => {
              const newColor = e.target.value || null
              setColorFilter(newColor)
              if (gradeFilter || newColor) {
                fetchFilteredClimbs(gradeFilter, newColor)
              } else {
                // Reset to original pagination
                setClimbs(initialClimbs)
                setAllClimbs([])
                setClimbsPage(0)
                setClimbsHasMore(initialClimbs.length >= CLIMBS_PAGE_SIZE)
              }
            }}
          >
            <option value="">All Colors</option>
            {['black','yellow','pink','teal','blue','purple','red','green'].map(color => (
              <option key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</option>
            ))}
          </select>
          {(gradeFilter || colorFilter) && (
            <button
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
              onClick={() => {
                setGradeFilter(null);
                setColorFilter(null);
                // Reset to original pagination
                setClimbs(initialClimbs)
                setAllClimbs([])
                setClimbsPage(0)
                setClimbsHasMore(initialClimbs.length >= CLIMBS_PAGE_SIZE)
              }}
            >
              Clear
            </button>
          )}
        </div>
        {climbs.length === 0 && <div className="card text-base-subtext">No climbs yet.</div>}

        {/* Filtered count display */}
        {(gradeFilter || colorFilter) && allClimbs.length > 0 && (
          <div className="text-sm text-base-subtext">
            Showing {climbs.filter(c => {
              if ((c as any).active_status === false && viewTab === 'active') return false
              if (((c as any).active_status ?? true) === true && viewTab === 'removed') return false
              return true
            }).length} of {allClimbs.filter(c => {
              if ((c as any).active_status === false && viewTab === 'active') return false
              if (((c as any).active_status ?? true) === true && viewTab === 'removed') return false
              return true
            }).length} filtered climbs
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {climbs.map(c => {
            if ((c as any).active_status === false && viewTab === 'active') return null
            if (((c as any).active_status ?? true) === true && viewTab === 'removed') return null
            const preview = previews[c.id]
            const colorMap: Record<string, string> = { black:'#000000', yellow:'#FFD60A', pink:'#FF6EA0', teal:'#14B8A6', blue:'#3B82F6', purple:'#8B5CF6', red:'#EF4444', green:'#22C55E' }
            const dot = c.color ? (colorMap[c.color] || '#8A2BE2') : '#8A2BE2'
            return (
              <div key={c.id} className="group relative rounded-xl overflow-hidden border border-white/5 bg-base-panel shadow min-h-[272px]">
                <button className="block w-full" onClick={async () => {
                  // Load full gallery for this climb
                  const supabase = await getSupabase()
                  const { data } = await supabase.from('climb_photos').select('id, climb_id, image_base64, created_at').eq('climb_id', c.id).order('created_at', { ascending: false })
                  setLightbox({ climbId: c.id, idx: 0, photos: (data || []) as Photo[] })
                }}>
                  <div className="aspect-video w-full bg-white/5">
                    {preview ? (
                      <img src={preview} alt={c.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full grid place-items-center bg-gradient-to-br from-neon-purple/30 to-transparent">
                        <div className="text-center text-sm text-base-subtext">
                          No photo yet
                        </div>
                      </div>
                    )}
                  </div>
                </button>
                {sentClimbIds.has(c.id) && (
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-700 text-white text-[11px] font-semibold shadow-lg ring-1 ring-black/40 backdrop-blur-sm">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z"/></svg>
                      Sent
                    </span>
                  </div>
                )}
                {/* Status moved inline next to title (no thumbnail overlay) */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button className="btn-primary px-2 py-1 text-xs" onClick={() => addPhoto(c.id)}>Add Photo</button>
                  {isAdmin && <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-2 py-1 text-xs" onClick={() => deleteClimb(c.id)}>Delete</button>}
                </div>
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
                  <Link href={`/climb/${c.id}?log=1`} className="bg-neon-purple text-white rounded-md px-3 py-1 text-xs">Log Send</Link>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: dot }} />
                    <Link href={`/climb/${c.id}`} className="font-semibold truncate hover:underline">{c.name}</Link>
                    {((c as any).active_status ?? true) ? (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-sm">Active</span>
                    ) : (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm">Removed</span>
                    )}
                    {c.dyno ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">Dyno</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-base-subtext">
                    {c.type} • Grade {c.grade ?? '-'}
                    {c.community_grade && (
                      <span className="text-neon-purple"> • Community: {c.community_grade}</span>
                    )}
                    {c.section?.name ? ` • ${c.section.name}` : c.location ? ` • ${c.location}` : ''}
                  </div>
                </div>
                {isAdmin && (
                  <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition">
                    <button className="bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 text-xs" onClick={() => setEditing({ open: true, climb: c, form: { name: c.name, type: c.type, grade: c.grade ?? 5, setter: c.setter ?? '', section_id: c.section_id ?? '', location: c.location ?? '', color: c.color ?? 'blue', dyno: !!c.dyno, active_status: (c as any).active_status ?? true } })}>Edit</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {climbsHasMore && (
          <div className="flex justify-center mt-6">
            <button
              className="bg-white/10 hover:bg-white/20 rounded-md px-6 py-3 text-sm"
              disabled={climbsLoading}
              onClick={loadMoreClimbs}
            >
              {climbsLoading ? 'Loading more climbs…' : 'Load more climbs'}
            </button>
          </div>
        )}
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold mb-2">Recent Activity</h2>
        {activityLoading && <div className="text-base-subtext">Loading…</div>}
        {!activityLoading && activity.length === 0 && <div className="text-base-subtext">No activity yet.</div>}
        <div className="grid gap-2">
          {activity.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              variant="gym"
              onBumpChange={(bumped, delta) => {
                setActivity(prev => prev.map(activityItem =>
                  activityItem.id === a.id
                    ? { ...activityItem, bumped, bump_count: Math.max(0, (activityItem.bump_count || 0) + delta) }
                    : activityItem
                ))
              }}
            />
          ))}
          {activityHasMore && (
            <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-2 text-sm" disabled={activityLoading} onClick={() => loadActivity(false)}>
              {activityLoading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      </div>

      {/* Add Climb Section - Collapsible */}
      {canCreate && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Add Climb</h2>
            <button
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
              onClick={() => setShowAddClimb(!showAddClimb)}
            >
              {showAddClimb ? 'Hide' : 'Show'}
            </button>
          </div>
          {showAddClimb && (
            <form className="grid gap-2 mt-3" onSubmit={createClimb}>
              <input className="input" placeholder="Climb name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                  <option value="boulder">Boulder</option>
                  <option value="top_rope">Top Rope</option>
                  <option value="lead">Lead</option>
                </select>
                <input className="input" placeholder="Grade (1-10)" type="number" min={1} max={10} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}>
                  <option value="">Select section…</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input className="input" placeholder="Or section name" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <input className="input" placeholder="Setter (optional)" value={form.setter} onChange={e => setForm(f => ({ ...f, setter: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
                  {['black','yellow','pink','teal','blue','purple','red','green'].map(c => (
                    <option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-base-subtext">
                  <input type="checkbox" checked={form.dyno} onChange={e => setForm(f => ({ ...f, dyno: e.target.checked }))} />
                  Dyno
                </label>
              </div>
              <button className="btn-primary">Create Climb</button>
            </form>
          )}
        </div>
      )}

      {/* Sections Management - Collapsible */}
      {isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Manage Sections/Walls</h2>
            <button
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
              onClick={() => setShowSections(!showSections)}
            >
              {showSections ? 'Hide' : 'Show'}
            </button>
          </div>
          {showSections && (
            <SectionManager
              gymId={gid}
              sections={sections}
              onAdded={(s) => setSections(prev => [...prev, s])}
              onRenamed={(id, name) => setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s))}
              onDeleted={(id) => setSections(prev => prev.filter(s => s.id !== id))}
            />
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video w-full bg-white/5 rounded-xl overflow-hidden">
              {lightbox.photos.length > 0 ? (
                <img src={`data:image/*;base64,${lightbox.photos[lightbox.idx].image_base64 || ''}`} alt="climb photo" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full grid place-items-center text-base-subtext">No photos yet</div>
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                {isAdmin && lightbox.photos.length > 0 && (
                  <button className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1"
                    onClick={() => deletePhoto(lightbox.photos[lightbox.idx].id, lightbox.climbId)}>
                    Delete
                  </button>
                )}
                <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={() => setLightbox(null)}>Close</button>
              </div>
              {lightbox.photos.length > 1 && (
                <>
                  <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full h-9 w-9" onClick={() => setLightbox(lb => lb ? ({ ...lb, idx: (lb.idx - 1 + lb.photos.length) % lb.photos.length }) : lb)}>
                    ‹
                  </button>
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-full h-9 w-9" onClick={() => setLightbox(lb => lb ? ({ ...lb, idx: (lb.idx + 1) % lb.photos.length }) : lb)}>
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-base-subtext">{photoCounts[lightbox.climbId] ? `${photoCounts[lightbox.climbId]} photo${photoCounts[lightbox.climbId] > 1 ? 's' : ''}` : 'No photos'}</div>
              <div className="flex items-center gap-2">
                <button className="btn-primary px-3 py-1" onClick={() => addPhoto(lightbox.climbId)}>Add Photo</button>
                {isAdmin && (
                  <button className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1" onClick={() => quickLog(lightbox.climbId)}>Quick Log</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {editing.open && editing.climb && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setEditing({ open: false, climb: null, form: null })}>
          <div className="bg-base-panel rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Edit Climb</h3>
            <form className="grid gap-3" onSubmit={updateClimb}>
              <input className="input" placeholder="Climb name" value={editing.form.name} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, name: e.target.value } }))} required />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={editing.form.type} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, type: e.target.value } }))}>
                  <option value="boulder">Boulder</option>
                  <option value="top_rope">Top Rope</option>
                  <option value="lead">Lead</option>
                </select>
                <input className="input" placeholder="Grade (1-10)" type="number" min={1} max={10} value={editing.form.grade} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, grade: Number(e.target.value) } }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={editing.form.section_id} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, section_id: e.target.value } }))}>
                  <option value="">Select section…</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input className="input" placeholder="Or section name" value={editing.form.location} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, location: e.target.value } }))} />
              </div>
              <input className="input" placeholder="Setter (optional)" value={editing.form.setter} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, setter: e.target.value } }))} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={editing.form.color} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, color: e.target.value } }))}>
                  {['black','yellow','pink','teal','blue','purple','red','green'].map(c => (
                    <option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-base-subtext">
                  <input type="checkbox" checked={editing.form.dyno} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, dyno: e.target.checked } }))} /> Dyno
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-base-subtext">
                <input type="checkbox" checked={editing.form.active_status !== false} onChange={e => setEditing(prev => ({ ...prev, form: { ...prev.form, active_status: e.target.checked } }))} /> Active
              </label>
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="bg-white/10 hover:bg-white/20 rounded-md px-4 py-2" onClick={() => setEditing({ open: false, climb: null, form: null })}>Cancel</button>
                <button className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Section Manager Component
function SectionManager({
  gymId,
  sections,
  onAdded,
  onRenamed,
  onDeleted
}: {
  gymId: string
  sections: Section[]
  onAdded: (s: Section) => void
  onRenamed: (id: string, name: string) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function addSection(e: React.FormEvent) {
    console.log('[DEBUG] addSection function called with name:', name)
    e.preventDefault()
    if (!name.trim()) {
      console.log('[DEBUG] Empty name, returning early')
      return
    }
    setBusy(true)
    try {
      console.log('[DEBUG] Adding section:', { gymId, name: name.trim() })
      const supabase = await getSupabase()
      const { data, error } = await supabase
        .from('gym_sections')
        .insert({ gym_id: gymId, name: name.trim() })
        .select('id,name')
        .single()

      console.log('[DEBUG] Section insert result:', { data, error })

      if (error) throw error

      console.log('[DEBUG] Section added successfully:', data)
      onAdded(data as Section)
      setName('')
    } catch (error: any) {
      console.error('[DEBUG] Error adding section:', error)
      const errorMessage = error.message || 'Failed to add section'
      alert(`Failed to add section: ${errorMessage}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3 mt-3">
      <form onSubmit={addSection} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="New section/wall name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || !name.trim()}
        >
          {busy ? 'Adding...' : 'Add'}
        </button>
      </form>
      {sections.length > 0 && (
        <div className="border border-white/5 rounded-lg divide-y divide-white/5">
          {sections.map(s => (
            <SectionRow
              key={s.id}
              section={s}
              onRenamed={onRenamed}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Section Row Component
function SectionRow({
  section,
  onRenamed,
  onDeleted
}: {
  section: Section
  onRenamed: (id: string, name: string) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(section.name)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('gym_sections')
        .update({ name: name.trim() })
        .eq('id', section.id)
      if (error) throw error
      onRenamed(section.id, name.trim())
      setEditing(false)
    } catch (error: any) {
      alert(error.message || 'Failed to update section')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm('Delete section? Climbs will keep their previous location text.')) return
    setBusy(true)
    try {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('gym_sections')
        .delete()
        .eq('id', section.id)
      if (error) throw error
      onDeleted(section.id)
    } catch (error: any) {
      alert(error.message || 'Failed to delete section')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 flex items-center gap-2">
      {editing ? (
        <>
          <input
            className="input flex-1"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button
            className="btn-primary px-3 py-1 text-sm"
            onClick={save}
            disabled={busy || !name.trim()}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button
            className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1 text-sm"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 font-medium">{section.name}</div>
          <button
            className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1 text-sm"
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            Rename
          </button>
          <button
            className="bg-red-500/80 hover:bg-red-600 text-white rounded-md px-3 py-1 text-sm"
            onClick={remove}
            disabled={busy}
          >
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </>
      )}
    </div>
  )
}
