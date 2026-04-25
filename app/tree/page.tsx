"use client"
import { useEffect, useState } from "react"
import { api, type Member } from "@/lib/api"
import styles from "./tree.module.css"

// ─── Tree data model ──────────────────────────────────────────────────────────

type TreeNode = {
  key: string
  primary: Member
  spouse?: Member
  children: TreeNode[]       // children of both parents in this couple
  singleChildren: TreeNode[] // children of only the primary member
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
    if (!m.parentIds?.length) continue
    const childNode = findOwner(m.memberId)
    if (!childNode || childKeys.has(childNode.key)) continue
    for (const pid of m.parentIds) {
      const parentNode = findOwner(pid)
      if (parentNode && parentNode.key !== childNode.key) {
        // Couple's child only if both parents are listed
        const spouseId = parentNode.spouse?.memberId
        const hasBothParents = spouseId && m.parentIds.includes(spouseId)
        const list = hasBothParents ? parentNode.children : parentNode.singleChildren
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

export default function TreePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.members.list()
      .then(r => setMembers(r.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const roots = buildForest(members)
  const deceased = members.filter(m => m.isDeceased)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Family Tree</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {members.length} members · {roots.length} branch{roots.length !== 1 ? "es" : ""}
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

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-gray-400">No members yet. Add members and link them via WhatsApp to build the tree.</p>
      ) : (
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
      )}
    </div>
  )
}
