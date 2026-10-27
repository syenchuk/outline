import { Suspense } from "react";
import { dateLocale, dateToRelative } from "@shared/utils/date";
import useUserLocale from "~/hooks/useUserLocale";
import type { Props as LocaleTimeProps } from "~/components/LocaleTime";
import lazyWithRetry from "@shared/utils/lazyWithRetry";

const LocaleTime = lazyWithRetry(() => import("~/components/LocaleTime"));

type Props = LocaleTimeProps & {
  onClick?: () => void;
};

function Time({ onClick, ...props }: Props) {
  const userLocale = useUserLocale();
  const content = dateToRelative(Date.parse(props.dateTime), {
    locale: dateLocale(userLocale),
    addSuffix: props.addSuffix,
    shorten: props.shorten,
  });

  return (
    <span onClick={onClick}>
      <Suspense
        fallback={
          <time dateTime={props.dateTime}>{props.children || content}</time>
        }
      >
        <LocaleTime {...props} />
      </Suspense>
    </span>
  );
}

export default Time;
