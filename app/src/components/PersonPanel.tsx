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
} from "lucide-react";
import type {
  MediaPerson,
  Person,
  PersonGear,
  PersonWeapon,
  WeaponAttachment,
  GearSlot,
  WeaponSlot,
} from "@/lib/types";
import { GEAR_SLOT_LABELS, WEAPON_SLOT_LABELS } from "@/lib/types";

interface PersonPanelProps {
  mediaPerson: MediaPerson;
  allPersons: Person[];
  onAssignPerson: (mpId: string, personId: string | null) => void;
  onCreatePerson: (callsign: string) => Promise<Person | null>;
  onRemove: (mpId: string) => void;
  onDataChange: () => void;
}

const GEAR_SLOTS: GearSlot[] = [
  "helmet", "headwear", "eyepro", "top", "pants",
  "lbe", "belt", "boots", "gloves", "comms", "accessories",
];

const WEAPON_SLOTS: WeaponSlot[] = [
  "muzzle_device", "handguard", "foregrip", "flashlight",
  "laser", "optic_rail", "optic", "stock", "magazine", "suppressor",
];

export function PersonPanel({
  mediaPerson,
  allPersons,
  onAssignPerson,
  onCreatePerson,
  onRemove,
  onDataChange,
}: PersonPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [weaponsExpanded, setWeaponsExpanded] = useState(true);
  const [newCallsign, setNewCallsign] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);

  // Gear add state
  const [addingGearSlot, setAddingGearSlot] = useState<GearSlot | null>(null);
  const [gearItemName, setGearItemName] = useState("");
  const [gearBrand, setGearBrand] = useState("");

  // Weapon add state
  const [addingWeapon, setAddingWeapon] = useState(false);
  const [weaponName, setWeaponName] = useState("");
  const [weaponType, setWeaponType] = useState("primary");
  const [weaponBrand, setWeaponBrand] = useState("");

  // Attachment add state
  const [addingAttachmentTo, setAddingAttachmentTo] = useState<string | null>(null);
  const [attachSlot, setAttachSlot] = useState<WeaponSlot>("optic");
  const [attachName, setAttachName] = useState("");
  const [attachBrand, setAttachBrand] = useState("");

  const gear = mediaPerson.gear || [];
  const weapons = mediaPerson.weapons || [];

  const handleAddGear = async () => {
    if (!gearItemName.trim() || !addingGearSlot) return;
    await fetch("/api/person-gear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_person_id: mediaPerson.id,
        slot: addingGearSlot,
        item_name: gearItemName.trim(),
        brand: gearBrand.trim() || null,
      }),
    });
    setAddingGearSlot(null);
    setGearItemName("");
    setGearBrand("");
    onDataChange();
  };

  const handleRemoveGear = async (id: string) => {
    await fetch(`/api/person-gear?id=${id}`, { method: "DELETE" });
    onDataChange();
  };

  const handleAddWeapon = async () => {
    if (!weaponName.trim()) return;
    await fetch("/api/person-weapons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_person_id: mediaPerson.id,
        weapon_type: weaponType,
        weapon_name: weaponName.trim(),
        brand: weaponBrand.trim() || null,
      }),
    });
    setAddingWeapon(false);
    setWeaponName("");
    setWeaponBrand("");
    onDataChange();
  };

  const handleRemoveWeapon = async (id: string) => {
    await fetch(`/api/person-weapons?id=${id}`, { method: "DELETE" });
    onDataChange();
  };

  const handleAddAttachment = async (weaponId: string) => {
    if (!attachName.trim()) return;
    await fetch("/api/weapon-attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_weapon_id: weaponId,
        slot: attachSlot,
        attachment_name: attachName.trim(),
        brand: attachBrand.trim() || null,
      }),
    });
    setAddingAttachmentTo(null);
    setAttachName("");
    setAttachBrand("");
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

        {/* Person ID dropdown */}
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
                      <button
                        onClick={() => handleRemoveGear(g.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 ml-auto"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {addingGearSlot === slot ? (
                    <div className="flex gap-1 mt-1">
                      <input
                        className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-28"
                        placeholder="Item name"
                        value={gearItemName}
                        onChange={(e) => setGearItemName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddGear()}
                        autoFocus
                      />
                      <input
                        className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-20"
                        placeholder="Brand"
                        value={gearBrand}
                        onChange={(e) => setGearBrand(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddGear()}
                      />
                      <button onClick={handleAddGear} className="text-blue-400 text-xs">Save</button>
                      <button onClick={() => setAddingGearSlot(null)} className="text-zinc-500 text-xs">X</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingGearSlot(slot); setGearItemName(""); setGearBrand(""); }}
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
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <select
                      className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-300"
                      value={attachSlot}
                      onChange={(e) => setAttachSlot(e.target.value as WeaponSlot)}
                    >
                      {WEAPON_SLOTS.map((s) => (
                        <option key={s} value={s}>{WEAPON_SLOT_LABELS[s]}</option>
                      ))}
                    </select>
                    <input
                      className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 w-24"
                      placeholder="Attachment"
                      value={attachName}
                      onChange={(e) => setAttachName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddAttachment(w.id)}
                      autoFocus
                    />
                    <input
                      className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 w-16"
                      placeholder="Brand"
                      value={attachBrand}
                      onChange={(e) => setAttachBrand(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddAttachment(w.id)}
                    />
                    <button onClick={() => handleAddAttachment(w.id)} className="text-blue-400 text-[10px]">Save</button>
                    <button onClick={() => setAddingAttachmentTo(null)} className="text-zinc-500 text-[10px]">X</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingAttachmentTo(w.id); setAttachName(""); setAttachBrand(""); }}
                    className="text-[10px] text-zinc-600 hover:text-amber-400 mt-0.5"
                  >
                    + attachment
                  </button>
                )}
              </div>
            </div>
          ))}

          {addingWeapon ? (
            <div className="flex gap-1 mt-1 flex-wrap">
              <select
                className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-300"
                value={weaponType}
                onChange={(e) => setWeaponType(e.target.value)}
              >
                <option value="primary">Primary</option>
                <option value="sidearm">Sidearm</option>
                <option value="secondary">Secondary</option>
              </select>
              <input
                className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-28"
                placeholder="Weapon name"
                value={weaponName}
                onChange={(e) => setWeaponName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWeapon()}
                autoFocus
              />
              <input
                className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 w-20"
                placeholder="Brand"
                value={weaponBrand}
                onChange={(e) => setWeaponBrand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWeapon()}
              />
              <button onClick={handleAddWeapon} className="text-blue-400 text-xs">Save</button>
              <button onClick={() => setAddingWeapon(false)} className="text-zinc-500 text-xs">X</button>
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
