"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { api, type Member, type FamilyRecord } from "@/lib/api"
import { MultiSelect } from "@/components/ui/multi-select"
import styles from "./tree.module.css"

// ─── Tree data model ──────────────────────────────────────────────────────────

type TreeNode = {
  key: string
  primary: Member
  spouse?: Member
  children: TreeNode[]       // children of both parents in this couple
  singleChildren: TreeNode[] // children of only the primary member
  relationNote?: string      // e.g. "(adoptive)" or "(step)"
  externalParents?: string[] // names of external (non-family) biological parents
}

function resolveParentsTree(m: Member): { memberId?: string; externalName?: string; type: string }[] {
  if (m.parents?.length) return m.parents
  return (m.parentIds ?? []).map(id => ({ memberId: id, type: "biological" }))
}

function buildForest(members: Member[]): TreeNode[] {
  const byId = new Map(members.map(m => [m.memberId, m]))
  const nodes = new Map<string, TreeNode>()
  const claimedAsSpouse = new Set<string>()

  for (const m of members) {
    if (claimedAsSpouse.has(m.memberId)) continue
    const node: TreeNode = { key: m.memberId, primary: m, children: [], singleChildren: [] }
    if (m.spouseId && byId.has(m.spouseId) && !claimedAsSpouse.has(m.spouseId)) {
      node.spouse = byId.get(m.spouseId)!
      claimedAsSpouse.add(m.spouseId)
    }
    nodes.set(m.memberId, node)
  }

  function findOwner(id: string): TreeNode | undefined {
    if (nodes.has(id)) return nodes.get(id)
    for (const n of nodes.values()) {
      if (n.spouse?.memberId === id) return n
    }
  }

  const childKeys = new Set<string>()
  for (const m of members) {
    const parentLinks = resolveParentsTree(m)
    const inTreeLinks = parentLinks.filter(p => p.memberId && byId.has(p.memberId))
    if (!inTreeLinks.length) continue

    const childNode = findOwner(m.memberId)
    if (!childNode || childKeys.has(childNode.key)) continue

    // Capture external parents for display
    const externalParents = parentLinks.filter(p => p.externalName).map(p => p.externalName!)
    if (externalParents.length) childNode.externalParents = externalParents

    for (const link of inTreeLinks) {
      const parentNode = findOwner(link.memberId!)
      if (parentNode && parentNode.key !== childNode.key) {
        const spouseId = parentNode.spouse?.memberId
        const hasBothParents = spouseId && inTreeLinks.some(p => p.memberId === spouseId)
        const list = hasBothParents ? parentNode.children : parentNode.singleChildren

        // Set relation note based on parent type
        if (link.type === "adoptive") childNode.relationNote = "(adoptive)"
        else if (link.type === "step") childNode.relationNote = "(step)"

        if (!list.find(c => c.key === childNode.key)) {
          list.push(childNode)
          childKeys.add(childNode.key)
        }
        break
      }
    }
  }

  return [...nodes.values()].filter(n => !childKeys.has(n.key))
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const DEPTH_COLORS = [
  "#7c3aed", // violet  — generation 0
  "#0891b2", // cyan    — generation 1
  "#059669", // emerald — generation 2
  "#d97706", // amber   — generation 3
  "#e11d48", // rose    — generation 4+
]

function depthColor(depth: number) {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)]
}

function initials(m: Member) {
  return [m.firstName[0], m.lastName?.[0]].filter(Boolean).join("").toUpperCase()
}

// ─── Components ───────────────────────────────────────────────────────────────

function MemberSlot({ member, color }: { member: Member; color: string }) {
  const deceased = !!member.isDeceased
  const attending = !deceased && member.rsvpStatus === "yes"
  return (
    <div className={styles.member}>
      <div
        className={`${styles.avatar} ${deceased ? styles.avatarDeceased : ""}`}
        style={deceased ? undefined : { background: color }}
      >
        {initials(member)}
      </div>
      <div className={styles.nameBlock}>
        <span className={deceased ? styles.nameDeceased : styles.name}>
          {member.firstName} {member.lastName ?? ""}
          {deceased ? " †" : ""}
        </span>
        {attending && <span className={styles.rsvpBadge}>Attending ✓</span>}
      </div>
    </div>
  )
}

function NodeCard({
  node, depth, hasChildren, expanded, onToggle,
}: {
  node: TreeNode; depth: number; hasChildren: boolean; expanded: boolean; onToggle: () => void
}) {
  const color = depthColor(depth)
  const bothDeceased = node.primary.isDeceased && (!node.spouse || node.spouse.isDeceased)
  return (
    <div
      className={`${styles.card} ${bothDeceased ? styles.cardDeceased : ""} ${hasChildren ? styles.cardClickable : ""}`}
      style={{ "--accent": color } as React.CSSProperties}
      onClick={hasChildren ? onToggle : undefined}
      role={hasChildren ? "button" : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <div className={styles.accentBar} />
      <div className={styles.cardBody}>
        <MemberSlot member={node.primary} color={color} />
        {node.spouse && (
          <>
            <div className={styles.divider}>❤</div>
            <MemberSlot member={node.spouse} color={color} />
          </>
        )}
        {hasChildren && (
          <div className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}
      </div>
      {(node.relationNote || node.externalParents?.length) && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {node.relationNote && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {node.relationNote}
            </span>
          )}
          {node.externalParents?.map(name => (
            <span key={name} className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
              bio: {name} (external)
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TreeNodeBlock({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children.length > 0
  const hasSingleChildren = node.singleChildren.length > 0
  const hasAnyChildren = hasChildren || hasSingleChildren
  return (
    <div className={styles.nodeBlock}>
      <div className={styles.cardRow}>
        {depth > 0 && <div className={styles.hConnector} />}
        <NodeCard
          node={node}
          depth={depth}
          hasChildren={hasAnyChildren}
          expanded={expanded}
          onToggle={() => setExpanded(e => !e)}
        />
      </div>
      {hasAnyChildren && expanded && (
        <div className={styles.childrenSection}>
          {node.children.map(child => (
            <TreeNodeBlock key={child.key} node={child} depth={depth + 1} />
          ))}
          {hasSingleChildren && (
            <>
              {hasChildren && (
                <p className="text-xs text-gray-400 italic ml-4 mt-2 mb-1">
                  {node.primary.firstName}&apos;s children
                </p>
              )}
              {node.singleChildren.map(child => (
                <TreeNodeBlock key={child.key} node={child} depth={depth + 1} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProfileBanner({ memberId }: { memberId: string }) {
  const [incomplete, setIncomplete] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.members.list().then(({ items }) => {
      const me = items.find(m => m.memberId === memberId)
      if (me && (!me.firstName || !me.dob || !me.rsvpStatus || me.rsvpStatus === "pending")) {
        setIncomplete(true)
      }
    }).catch(() => {})
  }, [memberId])

  if (!incomplete || dismissed) return null

  return (
    <div className="mb-6 flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <p className="text-sm text-amber-800">
        Your profile is incomplete. Add your RSVP and personal details so the family knows you&apos;re coming.
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/profile" className="text-sm font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2">
          Complete profile
        </Link>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600" aria-label="Dismiss">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function TreeView({ members, loading }: { members: Member[]; loading: boolean }) {
  const roots = buildForest(members)
  const deceased = members.filter(m => m.isDeceased)

  if (loading) return <p className="text-gray-400">Loading…</p>
  if (members.length === 0) return <p className="text-gray-400">No members yet. Add members and link them via WhatsApp to build the tree.</p>

  return (
    <div>
      <div className={styles.treeStack}>
        {roots.map(node => (
          <TreeNodeBlock key={node.key} node={node} depth={0} />
        ))}
      </div>

      {deceased.length > 0 && (
        <div className="mt-10 pt-8 border-t border-stone-200">
          <p className="text-sm font-semibold text-gray-500 mb-4">🕊 In Loving Memory</p>
          <div className="flex flex-wrap gap-3">
            {deceased.map(m => (
              <div key={m.memberId} className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-stone-500 italic">
                  {m.firstName} {m.lastName ?? ""} †
                </p>
                {m.deathDate && (
                  <p className="text-xs text-stone-400 mt-0.5">d. {m.deathDate.slice(0, 4)}</p>
                )}
                {m.tribute && (
                  <p className="text-xs text-stone-400 mt-1 italic">"{m.tribute}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TreePage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [families, setFamilies] = useState<FamilyRecord[]>([])
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = api.members.list().then(r => setAllMembers(r.items))
    if (role === "admin") {
      Promise.all([base, api.families.list().then(r => setFamilies(r.items))])
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      base.catch(() => {}).finally(() => setLoading(false))
    }
  }, [role])

  const visibleMembers = role === "admin"
    ? (selectedFamilyIds.size === 0
        ? []
        : [...new Map(
            allMembers.filter(m => m.familyId && selectedFamilyIds.has(m.familyId)).map(m => [m.memberId, m])
          ).values()])
    : allMembers

  const roots = buildForest(visibleMembers)

  return (
    <div>
      {session?.user?.memberId && <ProfileBanner memberId={session.user.memberId} />}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Family Tree</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {visibleMembers.length} members · {roots.length} branch{roots.length !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {DEPTH_COLORS.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span style={{ background: c }} className="inline-block w-2.5 h-2.5 rounded-full" />
              Gen {i}{i === DEPTH_COLORS.length - 1 ? "+" : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Admin: family multi-select */}
      {role === "admin" && (
        <div className="mb-6 flex items-center gap-3">
          <MultiSelect
            options={families.map(f => ({ value: f.familyId, label: f.familyName }))}
            selected={selectedFamilyIds}
            onChange={setSelectedFamilyIds}
            placeholder="Select families…"
            className="w-64"
          />
          {selectedFamilyIds.size === 0 && (
            <p className="text-xs text-gray-400">Select one or more families to render the tree.</p>
          )}
        </div>
      )}

      <TreeView members={visibleMembers} loading={loading} />
    </div>
  )
}
