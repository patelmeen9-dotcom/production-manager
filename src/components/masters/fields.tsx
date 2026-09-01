import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TextField(props: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
      />
    </div>
  );
}

export function ActiveCheckbox(props: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-200">
      <input type="checkbox" name="isActive" defaultChecked={props.defaultChecked ?? true} />
      Active
    </label>
  );
}
