import {
  Text, Stack,
} from "@mantine/core";
import stripP from "../../../utils/formatters/stripP";

function Stat({
  label, value, subtitle,
}) {
  return (
    <Stack className="cp-stat" align="flex-start" maw={250} spacing={0} my="md">
      {label && (
        <Text dangerouslySetInnerHTML={{__html: stripP(label)}} span />
      )}
      <Text size="xl" dangerouslySetInnerHTML={{__html: stripP(value)}} span />
      {subtitle && subtitle !== "<p>New Subtitle</p>" && (
        <Text dangerouslySetInnerHTML={{__html: stripP(subtitle)}} tt="uppercase" span />
      )}
    </Stack>
  );
}

export default Stat;