import { registerTool } from "./registry";
import { User } from "../../db/models/User";

// Called whenever the user reveals something about themselves in normal
// conversation (not just during a fixed onboarding phase) — this is how the
// assistant "continues learning naturally" per the product's design intent,
// instead of front-loading a form.
registerTool({
  name: "update_user_profile",
  description: "Save something learned about the user (role, interests, companies, timezone) from conversation, any time it comes up. Array fields are additive.",
  parameters: {
    type: "object",
    properties: {
      role: { type: "string" },
      addVerticals: { type: "array", items: { type: "string" } },
      addTopics: { type: "array", items: { type: "string" } },
      addIndustries: { type: "array", items: { type: "string" } },
      addCompanies: { type: "array", items: { type: "string" } },
      timezone: { type: "string", description: "IANA tz, e.g. Asia/Kolkata." },
    },
  },
  execute: async (
    args: {
      role?: string;
      addVerticals?: string[];
      addTopics?: string[];
      addIndustries?: string[];
      addCompanies?: string[];
      timezone?: string;
    },
    ctx
  ) => {
    const update: Record<string, unknown> = {};
    const addToSet: Record<string, unknown> = {};

    if (args.role) update.role = args.role;
    if (args.timezone) {
      update.timezone = args.timezone;
      update.timezoneConfirmed = true;
    }
    if (args.addVerticals?.length) addToSet.verticals = { $each: args.addVerticals.map((v) => v.toLowerCase()) };
    if (args.addTopics?.length) addToSet.topics = { $each: args.addTopics };
    if (args.addIndustries?.length) addToSet.industries = { $each: args.addIndustries };
    if (args.addCompanies?.length) addToSet.companiesFollowed = { $each: args.addCompanies.map((c) => c.toUpperCase()) };

    const ops: Record<string, unknown> = {};
    if (Object.keys(update).length) ops.$set = update;
    if (Object.keys(addToSet).length) ops.$addToSet = addToSet;
    if (Object.keys(ops).length === 0) return { updated: false };

    await User.updateOne({ telegramId: ctx.telegramId }, ops);
    return { updated: true };
  },
});
