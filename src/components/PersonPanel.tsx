"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Crosshair,
  Shield,
  User,
  Tag,
} from "lucide-react";
import { SearchableInput } from "./SearchableInput";
import type {
  MediaPerson,
  Person,
  PersonGear,
  PersonWeapon,
  WeaponAttachment,
  GearSlot,
  WeaponSlot,
} from "@/lib/types";
import { GEAR_SLOT_LABELS, WEAPON_SLOT_LABELS, GEAR_SLOT_CATEGORIES } from "@/lib/types";

interface PersonPanelProps {
  mediaPerson: MediaPerson;
  allPersons: Person[];
  onAssignPerson: (mpId: string, personId: string | null) => void;
  onCreatePerson: (callsign: string) => Promise<Person | null>;
  onRemove: (mpId: string) => void;
  onDataChange: () => void;
  onRequestAnnotation?: (gearId: string, gearName: string, personIndex: number) => void;
}

const GEAR_SLOTS: GearSlot[] = [
  "helmet", "headwear", "eyepro", "top", "pants",
  "lbe", "belt", "boots", "gloves", "comms", "accessories",
];

const WEAPON_SLOTS: WeaponSlot[] = [
  "muzzle_device", "handguard", "foregrip", "flashlight",
  "laser", "optic_rail", "optic", "stock", "magazine", "suppressor", "other",
];

export function PersonPanel({
  mediaPerson,
  allPersons,
  onAssignPerson,
  onCreatePerson,
  onRemove,
  onDataChange,
  onRequestAnnotation,
}: PersonPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [weaponsExpanded, setWeaponsExpanded] = useState(true);
  const [newCallsign, setNewCallsign] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);

  // Which slot is open for adding
  const [addingGearSlot, setAddingGearSlot] = useState<GearSlot | null>(null);
  const [addingWeapon, setAddingWeapon] = useState(false);
  const [weaponType, setWeaponType] = useState("primary");
  const [addingAttachmentTo, setAddingAttachmentTo] = useState<string | null>(null);
  const [attachSlot, setAttachSlot] = useState<WeaponSlot>("optic");

  const gear = mediaPerson.gear || [];
  const weapons = mediaPerson.weapons || [];

  const handleAddGearFromDB = async (slot: GearSlot, itemName: string, brand: string | null) => {
    await fetch("/api/person-gear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_person_id: mediaPerson.id,
        slot,
        item_name: itemName,
        brand: brand || null,
      }),
    });
    setAddingGearSlot(null);
    onDataChange();
  };

  const handleRemoveGear = async (id: string) => {
    await fetch(`/api/person-gear?id=${id}`, { method: "DELETE" });
    onDataChange();
  };

  const handleAddWeaponFromDB = async (weaponName: string, brand: string | null, wType: string) => {
    await fetch("/api/person-weapons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_person_id: mediaPerson.id,
        weapon_type: wType,
        weapon_name: weaponName,
        brand: brand || null,
      }),
    });
    setAddingWeapon(false);
    onDataChange();
  };

  const handleRemoveWeapon = async (id: string) => {
    await fetch(`/api/person-weapons?id=${id}`, { method: "DELETE" });
    onDataChange();
  };

  const handleAddAttachmentFromDB = async (weaponId: string, slot: WeaponSlot, name: string, brand: string | null) => {
    await fetch("/api/weapon-attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_weapon_id: weaponId,
        slot,
        attachment_name: name,
        brand: brand || null,
      }),
    });
    setAddingAttachmentTo(null);
    onDataChange();
  };

  const handleRemoveAttachment = async (id: string) => {
    await fetch(`/api/weapon-attachments?id=${id}`, { method: "DELETE" });
    onDataChange();
  };

  const handleCreateAndAssign = async () => {
    if (!newCallsign.trim()) return;
    const person = await onCreatePerson(newCallsign.trim());
    if (person) {
      onAssignPerson(mediaPerson.id, person.id);
    }
    setNewCallsign("");
    setShowNewPerson(false);
  };

  const gearBySlot: Record<string, PersonGear[]> = {};
  for (const g of gear) {
    if (!gearBySlot[g.slot]) gearBySlot[g.slot] = [];
    gearBySlot[g.slot].push(g);
  }

  return (
    <div className="border-b border-zinc-800">
      {/* Person header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50">
        <User size={14} className="text-blue-400" />
        <span className="text-sm font-medium text-blue-300">
          Person #{mediaPerson.person_index}
        </span>

        <select
          className="ml-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 flex-1"
          value={mediaPerson.person_id || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "__new__") {
              setShowNewPerson(true);
            } else {
              onAssignPerson(mediaPerson.id, val || null);
            }
          }}
        >
          <option value="">— Unidentified —</option>
          {allPersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.callsign}{p.real_name ? ` (${p.real_name})` : ""}
            </option>
          ))}
          <option value="__new__">+ Create New Person...</option>
        </select>

        <button
          onClick={() => onRemove(mediaPerson.id)}
          className="text-zinc-600 hover:text-red-400 p-1"
          title="Remove person"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* New person inline form */}
      {showNewPerson && (
        <div className="px-3 py-2 bg-zinc-900 flex gap-2">
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 flex-1"
            placeholder="Callsign / ID tag"
            value={newCallsign}
            onChange={(e) => setNewCallsign(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateAndAssign()}
            autoFocus
          />
          <button onClick={handleCreateAndAssign} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
            Create
          </button>
          <button onClick={() => setShowNewPerson(false)} className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded">
            Cancel
          </button>
        </div>
      )}

      {/* GEAR section */}
      <div className="px-3 py-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-full"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Shield size={12} /> Gear
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2">
          {GEAR_SLOTS.map((slot) => {
            const items = gearBySlot[slot] || [];
            const slotCategories = GEAR_SLOT_CATEGORIES[slot];
            const searchUrl = `/api/items/search?categories=${encodeURIComponent(slotCategories.join(","))}`;

            return (
              <div key={slot} className="flex items-start gap-2 py-1 border-b border-zinc-800/50 last:border-0">
                <span className="text-[10px] text-zinc-500 w-24 pt-0.5 flex-shrink-0 uppercase tracking-wide">
                  {GEAR_SLOT_LABELS[slot]}
                </span>
                <div className="flex-1 min-w-0">
                  {items.map((g) => (
                    <div key={g.id} className="flex items-center gap-1 group">
                      <span className="text-xs text-zinc-200 truncate">{g.item_name}</span>
                      {g.brand && (
                        <span className="text-[10px] text-zinc-500">({g.brand})</span>
                      )}
                      {onRequestAnnotation && (
                        <button
                          onClick={() => onRequestAnnotation(g.id, g.item_name, mediaPerson.person_index)}
                          className="text-blue-500/50 hover:text-blue-400 ml-1"
                          title="Draw bounding box on image"
                        >
                          <Tag size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveGear(g.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 ml-auto"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {addingGearSlot === slot ? (
                    <div className="mt-1">
                      <SearchableInput
                        fetchUrl={searchUrl}
                        placeholder={`Search ${GEAR_SLOT_LABELS[slot]}...`}
                        autoFocus
                        onSelect={(item) => handleAddGearFromDB(slot, item.name, item.brand || null)}
                        onCustomSubmit={(name) => handleAddGearFromDB(slot, name, null)}
                      />
                      <button
                        onClick={() => setAddingGearSlot(null)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-0.5"
                      >
                        cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingGearSlot(slot)}
                      className="text-[10px] text-zinc-600 hover:text-blue-400 mt-0.5"
                    >
                      + add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WEAPONS section */}
      <div className="px-3 py-1 border-t border-zinc-800/50">
        <button
          onClick={() => setWeaponsExpanded(!weaponsExpanded)}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider w-full"
        >
          {weaponsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Crosshair size={12} /> Weapons ({weapons.length})
        </button>
      </div>

      {weaponsExpanded && (
        <div className="px-3 pb-3">
          {weapons.map((w) => (
            <div key={w.id} className="mb-2 bg-zinc-900/50 rounded p-2">
              <div className="flex items-center gap-2 group">
                <span className="text-[10px] text-amber-500 uppercase">{w.weapon_type}</span>
                <span className="text-xs text-zinc-200 font-medium">{w.weapon_name}</span>
                {w.brand && <span className="text-[10px] text-zinc-500">({w.brand})</span>}
                {onRequestAnnotation && (
                  <button
                    onClick={() => onRequestAnnotation(w.id, w.weapon_name, mediaPerson.person_index)}
                    className="text-amber-500/50 hover:text-amber-400"
                    title="Draw bounding box on image"
                  >
                    <Tag size={10} />
                  </button>
                )}
                <button
                  onClick={() => handleRemoveWeapon(w.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 ml-auto"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {/* Attachments */}
              <div className="ml-4 mt-1">
                {(w.attachments || []).map((a) => (
                  <div key={a.id} className="flex items-center gap-1 text-[10px] group py-0.5">
                    <span className="text-zinc-500 w-16">{WEAPON_SLOT_LABELS[a.slot]}</span>
                    <span className="text-zinc-300">{a.attachment_name}</span>
                    {a.brand && <span className="text-zinc-600">({a.brand})</span>}
                    <button
                      onClick={() => handleRemoveAttachment(a.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 ml-auto"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                ))}

                {addingAttachmentTo === w.id ? (
                  <div className="mt-1">
                    <div className="flex gap-1 mb-1">
                      <select
                        className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-300"
                        value={attachSlot}
                        onChange={(e) => setAttachSlot(e.target.value as WeaponSlot)}
                      >
                        {WEAPON_SLOTS.map((s) => (
                          <option key={s} value={s}>{WEAPON_SLOT_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <SearchableInput
                      fetchUrl={`/api/attachments/search?slot=${attachSlot}`}
                      placeholder={`Search ${WEAPON_SLOT_LABELS[attachSlot]}...`}
                      autoFocus
                      onSelect={(item) => handleAddAttachmentFromDB(w.id, attachSlot, item.name, item.brand || null)}
                      onCustomSubmit={(name) => handleAddAttachmentFromDB(w.id, attachSlot, name, null)}
                    />
                    <button
                      onClick={() => setAddingAttachmentTo(null)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-0.5"
                    >
                      cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingAttachmentTo(w.id); }}
                    className="text-[10px] text-zinc-600 hover:text-amber-400 mt-0.5"
                  >
                    + attachment
                  </button>
                )}
              </div>
            </div>
          ))}

          {addingWeapon ? (
            <div className="mt-1">
              <div className="flex gap-1 mb-1">
                <select
                  className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-300"
                  value={weaponType}
                  onChange={(e) => setWeaponType(e.target.value)}
                >
                  <option value="primary">Primary</option>
                  <option value="sidearm">Sidearm</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
              <SearchableInput
                fetchUrl="/api/weapons/search"
                placeholder="Search weapons DB..."
                autoFocus
                onSelect={(item) => handleAddWeaponFromDB(item.name, item.brand || null, weaponType)}
                onCustomSubmit={(name) => handleAddWeaponFromDB(name, null, weaponType)}
              />
              <button
                onClick={() => setAddingWeapon(false)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-0.5"
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingWeapon(true)}
              className="text-xs text-zinc-600 hover:text-amber-400 flex items-center gap-1 mt-1"
            >
              <Plus size={10} /> Add Weapon
            </button>
          )}
        </div>
      )}
    </div>
  );
}
                                 