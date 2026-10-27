import { useTranslation } from "react-i18next";
import type { locales } from "@shared/utils/date";
import { unicodeBCP47toCLDR } from "@shared/utils/date";
import useCurrentUser from "./useCurrentUser";

/**
 * Returns the user's locale. Visitors who are not logged in get the language
 * detected for the interface, so that dates match the translated text.
 *
 * @returns The user's locale in CLDR format (en_US), if known.
 */
export default function useUserLocale() {
  const user = useCurrentUser({ rejectOnEmpty: false });
  const { i18n } = useTranslation();

  if (user) {
    return user.language;
  }

  return i18n.language
    ? (unicodeBCP47toCLDR(i18n.language) as keyof typeof locales)
    : undefined;
}
